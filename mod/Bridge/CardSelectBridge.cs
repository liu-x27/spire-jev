using System.Reflection;
using HarmonyLib;
using MegaCrit.Sts2.Core.AutoSlay.Helpers;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.GameActions;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace Sts2.NativeSim.FullAppBridge;

// spire-jev: every card selection the game makes through its selector —
// the smith's upgrade, a shop removal, an event's transform or enchant,
// True Grit+ or Burning Pact choosing from the hand — goes to the
// coordinator as a "card_select" decision instead of AutoSlay's random pick.
// What the selection is for is the name of the CardSelectCmd method that
// asked (FromDeckForRemoval, FromDeckForUpgrade, FromHand, ...).
public sealed class CardSelectContext
{
    public string Purpose { get; init; } = "";
    public int MinSelect { get; init; }
    public int MaxSelect { get; init; }
    public List<CardModel> Cards { get; init; } = new();
}

public static class CardSelectBridge
{
    private static string _purpose = "";

    public static void Apply(Harmony harmony)
    {
        MethodInfo setPurpose = AccessTools.Method(typeof(CardSelectBridge), nameof(SetPurpose));
        foreach (MethodInfo method in typeof(CardSelectCmd).GetMethods(BindingFlags.Public | BindingFlags.Static))
        {
            if (!method.Name.StartsWith("From", StringComparison.Ordinal)) continue;
            try { harmony.Patch(method, prefix: new HarmonyMethod(setPurpose)); }
            catch (Exception ex) { Godot.GD.PrintErr($"[FullAppBridge] card select purpose {method.Name}: {ex.Message}"); }
        }
        try
        {
            MethodInfo? select = AccessTools.Method(typeof(AutoSlayCardSelector), nameof(AutoSlayCardSelector.GetSelectedCards));
            if (select != null) harmony.Patch(select, prefix: new HarmonyMethod(AccessTools.Method(typeof(CardSelectBridge), nameof(HandleGetSelectedCards))));
        }
        catch (Exception ex) { Godot.GD.PrintErr($"[FullAppBridge] card selector: {ex.Message}"); }
        // spire-jev: a bundle choice (Scroll Boxes) never reaches the selector: in TestMode the game
        // takes the first bundle. Ask the coordinator instead, every bundle's cards as one list.
        try
        {
            MethodInfo? bundle = AccessTools.Method(typeof(CardSelectCmd), nameof(CardSelectCmd.FromChooseABundleScreen));
            if (bundle != null) harmony.Patch(bundle, prefix: new HarmonyMethod(AccessTools.Method(typeof(CardSelectBridge), nameof(HandleChooseABundle))));
        }
        catch (Exception ex) { Godot.GD.PrintErr($"[FullAppBridge] bundle select: {ex.Message}"); }
    }

    private static bool HandleChooseABundle(Player player, IReadOnlyList<IReadOnlyList<CardModel>> bundles, ref Task<IEnumerable<CardModel>> __result)
    {
        if (bundles == null || bundles.Count == 0) return true;
        __result = ChooseBundleAsync(player, bundles);
        return false;
    }

    /// <summary>The game's own bundle choice with the pick from the coordinator: the choice id reserved and synced as the original does.</summary>
    private static async Task<IEnumerable<CardModel>> ChooseBundleAsync(Player player, IReadOnlyList<IReadOnlyList<CardModel>> bundles)
    {
        uint choiceId = RunManager.Instance.PlayerChoiceSynchronizer.ReserveChoiceId(player);
        var cards = new List<CardModel>();
        var owner = new List<int>();
        for (int b = 0; b < bundles.Count; b++)
        {
            foreach (CardModel card in bundles[b])
            {
                cards.Add(card);
                owner.Add(b);
            }
        }
        _purpose = "FromChooseABundleScreen";
        CardModel? first = (await SelectAsync(cards, 1, 1)).FirstOrDefault();
        int index = first == null ? 0 : Math.Max(0, owner[Math.Max(0, cards.IndexOf(first))]);
        RunManager.Instance.PlayerChoiceSynchronizer.SyncLocalChoice(player, choiceId, PlayerChoiceResult.FromIndex(index));
        IReadOnlyList<CardModel> chosen = bundles[index];
        try { AccessTools.Method(typeof(CardSelectCmd), "LogChoice")?.Invoke(null, new object[] { player, chosen }); } catch { }
        return chosen;
    }

    private static void SetPurpose(MethodBase __originalMethod)
    {
        _purpose = __originalMethod.Name;
    }

    private static bool HandleGetSelectedCards(IEnumerable<CardModel> options, int minSelect, int maxSelect, ref Task<IEnumerable<CardModel>> __result)
    {
        __result = SelectAsync(options.ToList(), minSelect, maxSelect);
        return false;
    }

    /// <summary>Selections waiting on the planner: an event's options are hidden meanwhile (FullAppBridgeMod's event loop waits).</summary>
    public static int Pending;

    private static async Task<IEnumerable<CardModel>> SelectAsync(List<CardModel> cards, int minSelect, int maxSelect)
    {
        string purpose = _purpose;
        _purpose = "";
        if (cards.Count == 0) return Array.Empty<CardModel>();
        var context = new CardSelectContext { Purpose = purpose, MinSelect = minSelect, MaxSelect = maxSelect, Cards = cards };
        string actionId;
        Interlocked.Increment(ref Pending);
        try
        {
            actionId = await FullAppBridgeServer.WaitForCoordinatorActionAsync("card_select", isTerminal: false, isVictory: false, context);
        }
        finally
        {
            Interlocked.Decrement(ref Pending);
        }

        var chosen = new List<CardModel>();
        if (actionId.StartsWith("choose_cards:", StringComparison.Ordinal))
        {
            foreach (string part in actionId["choose_cards:".Length..].Split(','))
            {
                if (int.TryParse(part, out int i) && i >= 0 && i < cards.Count && !chosen.Contains(cards[i])) chosen.Add(cards[i]);
            }
        }
        else if (actionId.StartsWith("choose_card_select:", StringComparison.Ordinal))
        {
            string[] parts = actionId.Split(':');
            if (parts.Length > 1 && int.TryParse(parts[1], out int i) && i >= 0 && i < cards.Count) chosen.Add(cards[i]);
        }
        if (chosen.Count > maxSelect && maxSelect > 0) chosen = chosen.Take(maxSelect).ToList();
        // Too few (or an unknown action): fill from the front, so the game never waits on us.
        for (int i = 0; chosen.Count < minSelect && i < cards.Count; i++)
        {
            if (!chosen.Contains(cards[i])) chosen.Add(cards[i]);
        }
        return chosen;
    }
}
