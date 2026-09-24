using System.Reflection;
using MegaCrit.Sts2.Core.Map;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace Sts2.NativeSim.FullAppBridge;

// spire-jev: what the game knows about its acts, encounters, monsters and the
// current map, read at runtime so the numbers are the current ascension's
// (monster getters ask AscensionHelper). For planning and for the bot's
// reference tables; nothing here is written to the repository as game data.
public static class GameCatalog
{
    private const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    public static Dictionary<string, object?> Catalog()
    {
        var acts = new List<Dictionary<string, object?>>();
        var monsters = new Dictionary<string, Dictionary<string, object?>>();
        foreach (var act in ModelDb.All.OfType<ActModel>())
        {
            var a = new Dictionary<string, object?> { ["id"] = act.Id.Entry };
            try { a["floors"] = act.GetNumberOfFloors(false); } catch { }
            try { a["rooms"] = act.GetNumberOfRooms(false); } catch { }
            foreach (var (name, field) in new[] { ("weak", "_allWeakEncounters"), ("regular", "_allRegularEncounters"), ("elite", "_allEliteEncounters"), ("boss", "_allBossEncounters") })
            {
                try
                {
                    // The fields fill on first use of their properties (AllEliteEncounters, ...): ask the property first.
                    const BindingFlags Any = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
                    string property = "All" + char.ToUpperInvariant(field[4]) + field.Substring(5);
                    var list = (act.GetType().GetProperty(property, Any)?.GetValue(act)
                        ?? typeof(ActModel).GetField(field, Any)?.GetValue(act)) as IEnumerable<EncounterModel>;
                    a[name] = (list ?? Enumerable.Empty<EncounterModel>()).Select(e => new Dictionary<string, object?>
                    {
                        ["id"] = e.Id.Entry,
                        ["monsters"] = SafeMonsters(e).Select(m => m.Id.Entry).ToList(),
                    }).ToList();
                }
                catch (Exception ex) { a[name] = ex.Message; }
            }
            acts.Add(a);
        }
        foreach (var monster in ModelDb.All.OfType<MonsterModel>())
        {
            var d = new Dictionary<string, object?>();
            try { d["min_hp"] = monster.MinInitialHp; d["max_hp"] = monster.MaxInitialHp; } catch { }
            foreach (var prop in monster.GetType().GetProperties(Declared))
            {
                if (prop.GetIndexParameters().Length > 0) continue;
                if (prop.PropertyType != typeof(int) && prop.PropertyType != typeof(decimal) && prop.PropertyType != typeof(bool)) continue;
                try { d[prop.Name] = prop.GetValue(monster); } catch { }
            }
            monsters[monster.Id.Entry] = d;
        }
        int ascension = 0;
        try { ascension = RunManager.Instance?.DebugOnlyGetState()?.AscensionLevel ?? 0; } catch { }
        return new Dictionary<string, object?> { ["ascension"] = ascension, ["acts"] = acts, ["monsters"] = monsters };
    }

    private static IEnumerable<MonsterModel> SafeMonsters(EncounterModel e)
    {
        try { return e.AllPossibleMonsters.ToList(); } catch { return Enumerable.Empty<MonsterModel>(); }
    }

    public static Dictionary<string, object?> Map()
    {
        var d = new Dictionary<string, object?>();
        RunState? run = RunManager.Instance?.DebugOnlyGetState();
        if (run is null) return d;
        try { d["act_index"] = run.CurrentActIndex; } catch { }
        try { d["acts"] = run.Acts.Select(a => a.Id.Entry).ToList(); } catch { }
        try { d["ascension"] = run.AscensionLevel; } catch { }
        try
        {
            ActModel act = run.Act;
            foreach (string name in new[] { "BossEncounter", "SecondBossEncounter" })
            {
                var value = act.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)?.GetValue(act) as EncounterModel;
                if (value != null) d[name] = value.Id.Entry;
            }
        }
        catch { }
        try
        {
            ActMap map = run.Map;
            d["points"] = map.GetAllMapPoints().Select(p => new Dictionary<string, object?>
            {
                ["col"] = p.coord.col,
                ["row"] = p.coord.row,
                ["type"] = p.PointType.ToString(),
                ["children"] = p.Children.Select(c => new[] { c.coord.col, c.coord.row }).ToList(),
            }).ToList();
            d["boss_row"] = map.BossMapPoint?.coord.row;
            d["second_boss"] = map.SecondBossMapPoint != null;
        }
        catch (Exception ex) { d["error"] = ex.Message; }
        return d;
    }
}
