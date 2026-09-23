using System.Text.Json.Serialization;

namespace Sts2.NativeSim.FullAppBridge;

public sealed class RpcRequest
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("method")]
    public string Method { get; set; } = "";

    [JsonPropertyName("params")]
    public Dictionary<string, object?>? Params { get; set; }
}

public sealed class RpcResponse
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("result")]
    public object? Result { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public sealed class LegalActionDto
{
    [JsonPropertyName("action_id")]
    public string ActionId { get; set; } = "";

    [JsonPropertyName("action_type")]
    public string ActionType { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("metadata")]
    public Dictionary<string, object?>? Metadata { get; set; }
}

public sealed class ObservationDto
{
    [JsonPropertyName("schema_version")]
    public int SchemaVersion { get; set; } = 2;

    [JsonPropertyName("phase")]
    public string Phase { get; set; } = "";

    [JsonPropertyName("is_terminal")]
    public bool IsTerminal { get; set; }

    [JsonPropertyName("is_victory")]
    public bool IsVictory { get; set; }

    [JsonPropertyName("seed")]
    public string Seed { get; set; } = "";

    [JsonPropertyName("character")]
    public string Character { get; set; } = "";

    [JsonPropertyName("ascension")]
    public int Ascension { get; set; }

    [JsonPropertyName("act")]
    public int Act { get; set; }

    [JsonPropertyName("floor")]
    public int Floor { get; set; }

    [JsonPropertyName("gold")]
    public int Gold { get; set; }

    [JsonPropertyName("player_hp")]
    public int PlayerHp { get; set; }

    [JsonPropertyName("player_max_hp")]
    public int PlayerMaxHp { get; set; }

    [JsonPropertyName("player_block")]
    public int PlayerBlock { get; set; }

    [JsonPropertyName("player_energy")]
    public int PlayerEnergy { get; set; }

    [JsonPropertyName("player_powers")]
    public Dictionary<string, int> PlayerPowers { get; set; } = new();

    // spire-jev: each power's own numbers beside its amount (Shrink's damage
    // decrease, say), for the powers whose effect is not just the amount.
    [JsonPropertyName("player_power_vars")]
    public Dictionary<string, Dictionary<string, double>> PlayerPowerVars { get; set; } = new();

    [JsonPropertyName("deck_cards")]
    public List<string> DeckCards { get; set; } = new();

    [JsonPropertyName("relics")]
    public List<string> Relics { get; set; } = new();

    // spire-jev: each relic's numbers and counters (Tuning Fork's skills played so far).
    [JsonPropertyName("relic_vars")]
    public Dictionary<string, Dictionary<string, double>> RelicVars { get; set; } = new();

    [JsonPropertyName("potions")]
    public List<string> Potions { get; set; } = new();

    // spire-jev: how many slots there are, and each potion held with its numbers.
    [JsonPropertyName("potion_slots")]
    public int PotionSlots { get; set; }

    [JsonPropertyName("potion_details")]
    public List<Dictionary<string, object?>> PotionDetails { get; set; } = new();

    [JsonPropertyName("combat")]
    public CombatObservationDto? Combat { get; set; }

    [JsonPropertyName("room")]
    public RoomObservationDto? Room { get; set; }

    [JsonPropertyName("state_hash")]
    public string StateHash { get; set; } = "";
}

public sealed class CombatObservationDto
{
    [JsonPropertyName("turn")]
    public int Turn { get; set; }

    [JsonPropertyName("hand")]
    public List<CardObservationDto> Hand { get; set; } = new();

    [JsonPropertyName("draw_pile_count")]
    public int DrawPileCount { get; set; }

    [JsonPropertyName("discard_pile_count")]
    public int DiscardPileCount { get; set; }

    [JsonPropertyName("exhaust_pile_count")]
    public int ExhaustPileCount { get; set; }

    [JsonPropertyName("enemies")]
    public List<EnemyObservationDto> Enemies { get; set; } = new();

    // spire-jev: the piles' contents, not just their sizes. The draw pile is
    // listed in pile order, but a planner that respects hidden information
    // should treat it as a multiset — the player cannot see the order.
    [JsonPropertyName("draw_pile")]
    public List<CardObservationDto> DrawPile { get; set; } = new();

    [JsonPropertyName("discard_pile")]
    public List<CardObservationDto> DiscardPile { get; set; } = new();

    [JsonPropertyName("exhaust_pile")]
    public List<CardObservationDto> ExhaustPile { get; set; } = new();

    [JsonPropertyName("max_energy")]
    public int MaxEnergy { get; set; }
}

public sealed class CardObservationDto
{
    [JsonPropertyName("index")]
    public int Index { get; set; }

    [JsonPropertyName("card_id")]
    public string CardId { get; set; } = "";

    [JsonPropertyName("cost")]
    public int Cost { get; set; }

    [JsonPropertyName("can_play")]
    public bool CanPlay { get; set; }

    [JsonPropertyName("target_type")]
    public string TargetType { get; set; } = "";

    [JsonPropertyName("upgrades")]
    public int Upgrades { get; set; }

    // spire-jev: what the card will do. `cost` above is the canonical cost;
    // this is the cost after this turn's modifiers.
    [JsonPropertyName("current_cost")]
    public int CurrentCost { get; set; }

    [JsonPropertyName("costs_x")]
    public bool CostsX { get; set; }

    [JsonPropertyName("keywords")]
    public List<string> Keywords { get; set; } = new();

    /// <summary>Base values of the card's dynamic variables (Damage, Block, Vulnerable, Cards, …), before strength, weak and the like.</summary>
    [JsonPropertyName("vars")]
    public Dictionary<string, int> Vars { get; set; } = new();

    [JsonPropertyName("card_type")]
    public string CardType { get; set; } = "";

    // spire-jev: for choosing cards outside combat.
    [JsonPropertyName("rarity")]
    public string Rarity { get; set; } = "";

    // spire-jev, hand cards only: the card glows gold when its condition holds
    // (Spite once you have lost HP this turn), and a calculated var's value as
    // the game computes it now (Body Slam's damage from your block).
    [JsonPropertyName("glows")]
    public bool GlowsGold { get; set; }

    [JsonPropertyName("calculated")]
    public Dictionary<string, int> Calculated { get; set; } = new();

    // spire-jev: an enchantment changes a card's numbers for the rest of the
    // run (Nutritious Soup's on Strikes). Its id and amount, and every var
    // whose enchanted value is not its base value.
    [JsonPropertyName("enchantment")]
    public string Enchantment { get; set; } = "";

    [JsonPropertyName("enchantment_amount")]
    public int EnchantmentAmount { get; set; }

    [JsonPropertyName("enchanted")]
    public Dictionary<string, int> Enchanted { get; set; } = new();

    // The enchantment's own numbers (Corrupted's damage to you).
    [JsonPropertyName("enchantment_vars")]
    public Dictionary<string, double> EnchantmentVars { get; set; } = new();

    // spire-jev, hand cards only: numbers the card's own class keeps (Thrash's extra damage).
    [JsonPropertyName("fields")]
    public Dictionary<string, double> Fields { get; set; } = new();
}

public sealed class EnemyObservationDto
{
    [JsonPropertyName("combat_id")]
    public ulong CombatId { get; set; }

    [JsonPropertyName("model_id")]
    public string ModelId { get; set; } = "";

    [JsonPropertyName("hp")]
    public int Hp { get; set; }

    [JsonPropertyName("max_hp")]
    public int MaxHp { get; set; }

    [JsonPropertyName("block")]
    public int Block { get; set; }

    [JsonPropertyName("is_alive")]
    public bool IsAlive { get; set; }

    [JsonPropertyName("intent")]
    public string Intent { get; set; } = "";

    [JsonPropertyName("powers")]
    public Dictionary<string, int> Powers { get; set; } = new();

    [JsonPropertyName("power_vars")]
    public Dictionary<string, Dictionary<string, double>> PowerVars { get; set; } = new();

    // spire-jev: what the move will do, as the game shows it — attack damage
    // per hit against the player, with strength, weak and vulnerable applied.
    [JsonPropertyName("intents")]
    public List<IntentObservationDto> Intents { get; set; } = new();
}

public sealed class IntentObservationDto
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("damage")]
    public int Damage { get; set; }

    [JsonPropertyName("hits")]
    public int Hits { get; set; }
}

public sealed class RoomObservationDto
{
    [JsonPropertyName("room_type")]
    public string RoomType { get; set; } = "";

    [JsonPropertyName("options")]
    public List<string> Options { get; set; } = new();

    [JsonPropertyName("details")]
    public Dictionary<string, object?> Details { get; set; } = new();
}
