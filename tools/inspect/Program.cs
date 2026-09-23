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
                FieldInfo f => $"  field {Name(f.FieldType)} {f.Name}",
                MethodInfo m when !m.IsSpecialName => $"  meth  {Name(m.ReturnType)} {m.Name}({string.Join(", ", m.GetParameters().Select(p => Name(p.ParameterType) + " " + p.Name))})",
                _ => null,
            };
            if (line is not null) Console.WriteLine(line);
        }
        catch { }
    }
}
return 0;
