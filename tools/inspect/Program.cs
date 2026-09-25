using System.Reflection;
using System.Runtime.Loader;

// Usage: dotnet run -- <regex over full type names> [--members <regex over member names>]
// Lists matching types in sts2.dll with their base type and members, so a mod
// can be written against real names. Loads the assembly for reflection only;
// type initialisers are not run.

var gameData = Environment.GetEnvironmentVariable("STS2_DATA")
    ?? @"D:\SteamLibrary\steamapps\common\Slay the Spire 2\data_sts2_windows_x86_64";
if (args.Length == 0)
{
    Console.Error.WriteLine("usage: inspect <type regex> [--members <member regex>] [--derived <base type regex>]");
    return 2;
}

var ctx = new AssemblyLoadContext("inspect", isCollectible: true);
ctx.Resolving += (c, name) =>
{
    var path = Path.Combine(gameData, name.Name + ".dll");
    return File.Exists(path) ? c.LoadFromAssemblyPath(path) : null;
};
var asm = ctx.LoadFromAssemblyPath(Path.Combine(gameData, "sts2.dll"));

Type[] types;
try { types = asm.GetTypes(); }
catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t is not null).ToArray()!; }

var typeRe = new System.Text.RegularExpressions.Regex(args[0]);
string? memberPattern = null, derivedPattern = null;
for (var i = 1; i < args.Length - 1; i++)
{
    if (args[i] == "--members") memberPattern = args[i + 1];
    if (args[i] == "--derived") derivedPattern = args[i + 1];
}
var memberRe = memberPattern is null ? null : new System.Text.RegularExpressions.Regex(memberPattern);

const BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
string Name(Type? t) => t is null ? "?" : t.IsGenericType
    ? $"{t.Name.Split('`')[0]}<{string.Join(",", t.GetGenericArguments().Select(Name))}>"
    : t.Name;

// --il <method regex>: the IL of the matching methods of the matching types, async and iterator
// bodies included (their compiler-made MoveNext), with the members, fields and strings it names —
// to see what a game method waits on. Local reading only.
string? ilPattern = null;
for (var i = 1; i < args.Length - 1; i++) if (args[i] == "--il") ilPattern = args[i + 1];
if (ilPattern is not null)
{
    var methodRe = new System.Text.RegularExpressions.Regex(ilPattern);
    var ops = typeof(System.Reflection.Emit.OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static)
        .Select(f => (System.Reflection.Emit.OpCode)f.GetValue(null)!).ToDictionary(o => (ushort)o.Value);
    void Dump(MethodBase m, string label)
    {
        byte[]? il;
        try { il = m.GetMethodBody()?.GetILAsByteArray(); } catch { il = null; }
        if (il is null) return;
        Console.WriteLine($"== {label}");
        var module = m.Module;
        for (int pc = 0; pc < il.Length;)
        {
            int at = pc;
            ushort code = il[pc++];
            if (code == 0xFE) code = (ushort)(0xFE00 | il[pc++]);
            if (!ops.TryGetValue(code, out var op)) { Console.WriteLine($"  {at:X4} ?{code:X}"); continue; }
            string arg = "";
            int size = op.OperandType switch
            {
                System.Reflection.Emit.OperandType.InlineNone => 0,
                System.Reflection.Emit.OperandType.ShortInlineBrTarget or System.Reflection.Emit.OperandType.ShortInlineI or System.Reflection.Emit.OperandType.ShortInlineVar => 1,
                System.Reflection.Emit.OperandType.InlineVar => 2,
                System.Reflection.Emit.OperandType.InlineI8 or System.Reflection.Emit.OperandType.InlineR => 8,
                System.Reflection.Emit.OperandType.InlineSwitch => 4 + 4 * BitConverter.ToInt32(il, pc),
                _ => 4,
            };
            if (op.OperandType is System.Reflection.Emit.OperandType.InlineMethod or System.Reflection.Emit.OperandType.InlineField
                or System.Reflection.Emit.OperandType.InlineType or System.Reflection.Emit.OperandType.InlineTok)
            {
                try
                {
                    var mem = module.ResolveMember(BitConverter.ToInt32(il, pc), m.DeclaringType?.GetGenericArguments(), m.IsGenericMethod ? m.GetGenericArguments() : null);
                    arg = mem is null ? "" : $"{Name(mem.DeclaringType)}.{mem.Name}";
                    if (mem is MethodInfo gm && gm.IsGenericMethod) arg += $"<{string.Join(",", gm.GetGenericArguments().Select(Name))}>";
                }
                catch { arg = $"tok {BitConverter.ToInt32(il, pc):X8}"; }
            }
            else if (op.OperandType == System.Reflection.Emit.OperandType.InlineString)
            {
                try { arg = "\"" + module.ResolveString(BitConverter.ToInt32(il, pc)) + "\""; } catch { }
            }
            else if (op.OperandType == System.Reflection.Emit.OperandType.ShortInlineBrTarget) arg = $"-> {pc + 1 + (sbyte)il[pc]:X4}";
            else if (op.OperandType == System.Reflection.Emit.OperandType.InlineBrTarget) arg = $"-> {pc + 4 + BitConverter.ToInt32(il, pc):X4}";
            else if (op.OperandType == System.Reflection.Emit.OperandType.InlineI) arg = BitConverter.ToInt32(il, pc).ToString();
            else if (op.OperandType == System.Reflection.Emit.OperandType.ShortInlineI) arg = ((sbyte)il[pc]).ToString();
            else if (op.OperandType == System.Reflection.Emit.OperandType.InlineR) arg = BitConverter.ToDouble(il, pc).ToString();
            else if (op.OperandType == System.Reflection.Emit.OperandType.ShortInlineR) arg = BitConverter.ToSingle(il, pc).ToString();
            Console.WriteLine($"  {at:X4} {op.Name} {arg}");
            pc += size;
        }
    }
    foreach (var t in types.Where(t => typeRe.IsMatch(t.FullName ?? "") && !t.Name.Contains('<')))
    {
        foreach (var c in t.GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
            if (methodRe.IsMatch(c.Name)) Dump(c, $"{t.Name}.{c.Name}({string.Join(", ", c.GetParameters().Select(p => Name(p.ParameterType)))})");
        foreach (var m in t.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
        {
            if (!methodRe.IsMatch(m.Name)) continue;
            Dump(m, $"{t.Name}.{m.Name}");
            // The body of an async method or iterator lives in a nested state machine's MoveNext.
            foreach (var nested in t.GetNestedTypes(BindingFlags.NonPublic | BindingFlags.Public).Where(n => n.Name.StartsWith($"<{m.Name}>", StringComparison.Ordinal)))
            {
                var move = nested.GetMethod("MoveNext", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                if (move is not null) Dump(move, $"{t.Name}.{m.Name} (state machine {nested.Name})");
            }
        }
        // Lambdas the methods use, in the compiler's closure classes.
        foreach (var nested in t.GetNestedTypes(BindingFlags.NonPublic).Where(n => n.Name.StartsWith("<>c", StringComparison.Ordinal)))
            foreach (var m in nested.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.DeclaredOnly).Where(m => methodRe.IsMatch(m.Name)))
                Dump(m, $"{t.Name}.{nested.Name}.{m.Name}");
    }
    return 0;
}

if (derivedPattern is not null)
{
    var baseRe = new System.Text.RegularExpressions.Regex(derivedPattern);
    var derived = types.Where(t => t.BaseType is not null && baseRe.IsMatch(t.BaseType.FullName ?? "") && typeRe.IsMatch(t.FullName ?? "")).ToList();
    Console.WriteLine($"{derived.Count} types deriving from /{derivedPattern}/");
    foreach (var t in derived.OrderBy(t => t.FullName)) Console.WriteLine($"  {t.FullName}");
    return 0;
}

foreach (var t in types.Where(t => typeRe.IsMatch(t.FullName ?? "") && !t.Name.Contains('<')).OrderBy(t => t.FullName).Take(40))
{
    Console.WriteLine($"== {t.FullName} : {Name(t.BaseType)}");
    MemberInfo[] members;
    try { members = t.GetMembers(all); } catch { continue; }
    foreach (var mi in members.OrderBy(m => m.MemberType).ThenBy(m => m.Name))
    {
        if (mi.Name.Contains('<') || mi.Name.StartsWith("get_") || mi.Name.StartsWith("set_") || mi.Name.StartsWith("add_") || mi.Name.StartsWith("remove_")) continue;
        if (memberRe is not null && !memberRe.IsMatch(mi.Name)) continue;
        try
        {
            var line = mi switch
            {
                PropertyInfo p => $"  prop  {Name(p.PropertyType)} {p.Name}",
                FieldInfo f => $"  field {Name(f.FieldType)} {f.Name}" + (f.IsLiteral && f.FieldType.IsEnum ? $" = {Convert.ToInt64(f.GetRawConstantValue())}" : ""),
                MethodInfo m when !m.IsSpecialName => $"  meth  {Name(m.ReturnType)} {m.Name}({string.Join(", ", m.GetParameters().Select(p => Name(p.ParameterType) + " " + p.Name))})",
                _ => null,
            };
            if (line is not null) Console.WriteLine(line);
        }
        catch { }
    }
}
return 0;
