using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Context;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Entities.Merchant;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.Entities.RestSite;
using MegaCrit.Sts2.Core.Events;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Map;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.MonsterMoves.Intents;
using MegaCrit.Sts2.Core.Rooms;
using MegaCrit.Sts2.Core.Runs;

namespace Sts2.NativeSim.FullAppBridge;

public static class FullAppStateTracker
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    /// <summary>
    /// spire-jev: one card as a planner needs it — its current cost, keywords
    /// and the base values of its dynamic variables. Each read is guarded:
    /// a card outside combat, or one whose cost depends on state that is not
    /// there, reports what it can rather than failing the whole observation.
    /// </summary>
    // spire-jev: a power's dynamic vars, and the numbers its own class keeps
    // (fields declared on the concrete power, not on PowerModel).
    private static Dictionary<string, double> DescribePowerVars(PowerModel power)
    {
        var vars = new Dictionary<string, double>();
        try { foreach (var pair in power.DynamicVars) vars[pair.Key] = (double)pair.Value.BaseValue; } catch { }
        AddDeclaredNumbers(power, vars);
        return vars;
    }

    private static Dictionary<string, double> DescribeRelicVars(RelicModel relic)
    {
        var vars = new Dictionary<string, double>();
        try { foreach (var pair in relic.DynamicVars) vars[pair.Key] = (double)pair.Value.BaseValue; } catch { }
        try { if (relic.ShowCounter) vars["DisplayAmount"] = relic.DisplayAmount; } catch { }
        AddDeclaredNumbers(relic, vars);
        return vars;
    }

    // The numbers a model's own class keeps: fields declared on the concrete type.
    private static void AddDeclaredNumbers(object model, Dictionary<string, double> into)
    {
        try
        {
            const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
            foreach (var field in model.GetType().GetFields(flags))
            {
                object? value = field.GetValue(model);
                if (value is decimal d) into[field.Name] = (double)d;
                else if (value is int i) into[field.Name] = i;
                else if (value is bool b) into[field.Name] = b ? 1 : 0;
            }
        }
        catch { }
    }

    private static CardObservationDto DescribeCard(CardModel card, int index, bool canPlay, bool inHand = false)
    {
        var dto = new CardObservationDto
        {
            Index = index,
            CardId = card.Id.Entry,
            Cost = card.EnergyCost.Canonical,
            CanPlay = canPlay,
            TargetType = card.TargetType.ToString(),
            Upgrades = card.CurrentUpgradeLevel,
            CostsX = card.EnergyCost.CostsX,
            CardType = card.Type.ToString(),
        };
        try { dto.CurrentCost = card.EnergyCost.GetResolved(); } catch { dto.CurrentCost = dto.Cost; }
        try { dto.Rarity = card.Rarity.ToString(); } catch { }
        try
        {
            foreach (var keyword in card.Keywords) dto.Keywords.Add(keyword.ToString());
            dto.Keywords.Sort(StringComparer.Ordinal);
        }
        catch { }
        try
        {
            foreach (var pair in card.DynamicVars) dto.Vars[pair.Key] = (int)pair.Value.BaseValue;
        }
        catch { }
        try
        {
            if (card.Enchantment is { } enchantment)
            {
                dto.Enchantment = enchantment.Id.Entry;
                dto.EnchantmentAmount = enchantment.Amount;
                AddDeclaredNumbers(enchantment, dto.EnchantmentVars);
            }
            foreach (var pair in card.DynamicVars)
            {
                int enchanted = (int)pair.Value.EnchantedValue;
                if (enchanted != (int)pair.Value.BaseValue) dto.Enchanted[pair.Key] = enchanted;
            }
        }
        catch { }
        if (inHand)
        {
            try
            {
                const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
                foreach (var field in card.GetType().GetFields(flags))
                {
                    object? value = field.GetValue(card);
                    if (value is decimal d) dto.Fields[field.Name] = (double)d;
                    else if (value is int i) dto.Fields[field.Name] = i;
                    else if (value is bool b) dto.Fields[field.Name] = b ? 1 : 0;
                }
            }
            catch { }
            try { dto.GlowsGold = card.ShouldGlowGold; } catch { }
            try
            {
                Creature? target = card.CombatState?.HittableEnemies.FirstOrDefault();
                foreach (var pair in card.DynamicVars)
                {
                    if (pair.Value is CalculatedVar calculated) dto.Calculated[pair.Key] = (int)calculated.Calculate(target!);
                }
            }
            catch { }
        }
        return dto;
    }

    public static (ObservationDto Observation, List<LegalActionDto> LegalActions) CreateStateSnapshot(
        string phase,
        bool isTerminal,
        bool isVictory,
        object? contextObject = null)
    {
        RunManager? runManager = RunManager.Instance;
        CombatManager? combatManager = CombatManager.Instance;
        RunState? runState = runManager?.DebugOnlyGetState();
        Player? player = runState is not null ? LocalContext.GetMe(runState) : null;

        var obs = new ObservationDto
        {
            Phase = phase,
            IsTerminal = isTerminal,
            IsVictory = isVictory,
            Seed = runState?.Rng.StringSeed ?? "",
            Character = player?.Character.Id.Entry ?? "",
            Ascension = runState?.AscensionLevel ?? 0,
            Act = (runState?.CurrentActIndex ?? 0) + 1,
            Floor = runState?.TotalFloor ?? 0,
            Gold = player?.Gold ?? 0,
            PlayerHp = player?.Creature.CurrentHp ?? 0,
            PlayerMaxHp = player?.Creature.MaxHp ?? 0,
            PlayerBlock = player?.Creature.Block ?? 0,
            PlayerEnergy = player?.PlayerCombatState?.Energy ?? 0,
        };

        if (player is not null)
        {
            foreach (var power in player.Creature.Powers)
            {
                obs.PlayerPowers[power.Id.Entry] = power.Amount;
                var vars = DescribePowerVars(power);
                if (vars.Count > 0) obs.PlayerPowerVars[power.Id.Entry] = vars;
            }

            foreach (var card in player.Deck.Cards)
            {
                obs.DeckCards.Add(card.Id.Entry);
            }
            obs.DeckCards.Sort();

            foreach (var relic in player.Relics)
            {
                obs.Relics.Add(relic.Id.Entry);
                var relicVars = DescribeRelicVars(relic);
                if (relicVars.Count > 0) obs.RelicVars[relic.Id.Entry] = relicVars;
            }

            obs.PotionSlots = player.PotionSlots.Count;
            for (int slot = 0; slot < player.PotionSlots.Count; slot++)
            {
                var pot = player.PotionSlots[slot];
                if (pot is not null)
                {
                    obs.Potions.Add(pot.Id.Entry);
                    var d = new Dictionary<string, object?> { ["slot"] = slot, ["id"] = pot.Id.Entry };
                    try { d["rarity"] = pot.Rarity.ToString(); } catch { }
                    try { d["target"] = pot.TargetType.ToString(); } catch { }
                    try { d["usage"] = pot.Usage.ToString(); } catch { }
                    try
                    {
                        var vars = new Dictionary<string, int>();
                        foreach (var pair in pot.DynamicVars) vars[pair.Key] = (int)pair.Value.BaseValue;
                        d["vars"] = vars;
                    }
                    catch { }
                    obs.PotionDetails.Add(d);
                }
            }
        }

        var legalActions = new List<LegalActionDto>();

        if (phase == "combat" && combatManager is not null && combatManager.IsInProgress && player is not null)
        {
            var combatObs = new CombatObservationDto
            {
                Turn = player.PlayerCombatState?.TurnNumber ?? 1,
                DrawPileCount = PileType.Draw.GetPile(player).Cards.Count,
                DiscardPileCount = PileType.Discard.GetPile(player).Cards.Count,
                ExhaustPileCount = PileType.Exhaust.GetPile(player).Cards.Count,
                MaxEnergy = player.PlayerCombatState?.MaxEnergy ?? 0,
            };
            var drawCards = PileType.Draw.GetPile(player).Cards;
            for (int i = 0; i < drawCards.Count; i++) combatObs.DrawPile.Add(DescribeCard(drawCards[i], i, false));
            var discardCards = PileType.Discard.GetPile(player).Cards;
            for (int i = 0; i < discardCards.Count; i++) combatObs.DiscardPile.Add(DescribeCard(discardCards[i], i, false));
            var exhaustCards = PileType.Exhaust.GetPile(player).Cards;
            for (int i = 0; i < exhaustCards.Count; i++) combatObs.ExhaustPile.Add(DescribeCard(exhaustCards[i], i, false));

            var handCards = PileType.Hand.GetPile(player).Cards;
            for (int i = 0; i < handCards.Count; i++)
            {
                CardModel card = handCards[i];
                bool canPlay = card.CanPlay();
                combatObs.Hand.Add(DescribeCard(card, i, canPlay, inHand: true));

                if (canPlay)
                {
                    if (card.TargetType.IsSingleTarget() && card.TargetType != TargetType.Self)
                    {
                        var hittable = card.CombatState?.HittableEnemies.OrderBy(c => c.CombatId) ?? Enumerable.Empty<Creature>();
                        foreach (var enemy in hittable)
                        {
                            ulong enemyId = enemy.CombatId ?? 0;
                            legalActions.Add(new LegalActionDto
                            {
                                ActionId = $"play_card:{i}:target:{enemyId}",
                                ActionType = "play_card",
                                Description = $"Play {card.Id.Entry} targeting enemy {enemyId} ({enemy.CurrentHp}/{enemy.MaxHp})",
                                Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["target_id"] = enemyId, ["card_id"] = card.Id.Entry }
                            });
                        }
                    }
                    else
                    {
                        legalActions.Add(new LegalActionDto
                        {
                            ActionId = $"play_card:{i}",
                            ActionType = "play_card",
                            Description = $"Play {card.Id.Entry}",
                            Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["card_id"] = card.Id.Entry }
                        });
                    }
                }
            }

            ICombatState? combatState = combatManager.DebugOnlyGetState();
            if (combatState is not null)
            {
                foreach (var enemy in combatState.Enemies.OrderBy(e => e.CombatId))
                {
                    var enemyDto = new EnemyObservationDto
                    {
                        CombatId = enemy.CombatId ?? 0,
                        ModelId = enemy.ModelId.Entry,
                        Hp = enemy.CurrentHp,
                        MaxHp = enemy.MaxHp,
                        Block = enemy.Block,
                        IsAlive = enemy.IsAlive,
                        Intent = enemy.Monster?.NextMove.Id ?? "",
                    };
                    foreach (var p in enemy.Powers)
                    {
                        enemyDto.Powers[p.Id.Entry] = p.Amount;
                        var vars = DescribePowerVars(p);
                        if (vars.Count > 0) enemyDto.PowerVars[p.Id.Entry] = vars;
                    }
                    // spire-jev: the move's intents, with attack damage as the
                    // game computes it against the player.
                    try
                    {
                        var targets = new[] { player.Creature };
                        foreach (var intent in enemy.Monster?.NextMove?.Intents ?? (IReadOnlyList<AbstractIntent>)Array.Empty<AbstractIntent>())
                        {
                            var intentDto = new IntentObservationDto { Type = intent.IntentType.ToString() };
                            if (intent is AttackIntent attack)
                            {
                                intentDto.Damage = attack.GetSingleDamage(targets, enemy);
                                intentDto.Hits = attack.Repeats;
                            }
                            enemyDto.Intents.Add(intentDto);
                        }
                    }
                    catch { }
                    combatObs.Enemies.Add(enemyDto);
                }
            }

            for (int slot = 0; slot < player.PotionSlots.Count; slot++)
            {
                PotionModel? potion = player.PotionSlots[slot];
                if (potion is null) continue;
                if (potion.TargetType == TargetType.AnyEnemy)
                {
                    var hittable = player.Creature.CombatState?.HittableEnemies.OrderBy(c => c.CombatId) ?? Enumerable.Empty<Creature>();
                    foreach (var enemy in hittable)
                    {
                        ulong enemyId = enemy.CombatId ?? 0;
                        legalActions.Add(new LegalActionDto
                        {
                            ActionId = $"use_potion:{slot}:target:{enemyId}",
                            ActionType = "use_potion",
                            Description = $"Use potion {potion.Id.Entry} on enemy {enemyId}",
                            Metadata = new Dictionary<string, object?> { ["potion_index"] = slot, ["potion_id"] = potion.Id.Entry, ["target_id"] = enemyId }
                        });
                    }
                }
                else if (potion.TargetType is TargetType.AnyAlly or TargetType.AnyPlayer or TargetType.Self)
                {
                    ulong playerId = player.Creature.CombatId ?? 0;
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"use_potion:{slot}:target:{playerId}",
                        ActionType = "use_potion",
                        Description = $"Use potion {potion.Id.Entry} on player {playerId}",
                        Metadata = new Dictionary<string, object?> { ["potion_index"] = slot, ["potion_id"] = potion.Id.Entry, ["target_id"] = playerId }
                    });
                }
                else
                {
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"use_potion:{slot}",
                        ActionType = "use_potion",
                        Description = $"Use potion {potion.Id.Entry}",
                        Metadata = new Dictionary<string, object?> { ["potion_index"] = slot, ["potion_id"] = potion.Id.Entry }
                    });
                }
            }

            legalActions.Add(new LegalActionDto
            {
                ActionId = "end_turn",
                ActionType = "end_turn",
                Description = "End player turn",
            });

            obs.Combat = combatObs;
        }
        else if (phase == "map")
        {
            var roomObs = new RoomObservationDto { RoomType = "Map" };
            if (contextObject is List<MapPoint> reachablePoints)
            {
                for (int i = 0; i < reachablePoints.Count; i++)
                {
                    MapPoint point = reachablePoints[i];
                    string typeName = point.PointType.ToString();
                    int branch1Indexed = i + 1;
                    roomObs.Options.Add($"{branch1Indexed}:{typeName}");
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_map:{branch1Indexed}:{typeName}",
                        ActionType = "choose_map",
                        Description = $"{branch1Indexed} ({typeName})",
                        Metadata = new Dictionary<string, object?> { ["branch_choice"] = branch1Indexed, ["node_index"] = i, ["room_type"] = typeName }
                    });
                }
            }
            obs.Room = roomObs;
        }
        else if (phase == "card_reward")
        {
            var roomObs = new RoomObservationDto { RoomType = "CardReward" };
            if (contextObject is IReadOnlyList<CardModel> cardOptions)
            {
                // spire-jev: each offered card as combat describes it, numbers and all.
                roomObs.Details["cards"] = cardOptions.Select((c, i) => DescribeCard(c, i, false)).ToList();
                for (int i = 0; i < cardOptions.Count; i++)
                {
                    CardModel card = cardOptions[i];
                    roomObs.Options.Add(card.Id.Entry);
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_card:{i}:{card.Id.Entry}",
                        ActionType = "choose_card",
                        Description = $"Choose card reward {card.Id.Entry} (Cost: {card.EnergyCost.Canonical})",
                        Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["card_id"] = card.Id.Entry, ["upgrades"] = card.CurrentUpgradeLevel }
                    });
                }
                legalActions.Add(new LegalActionDto
                {
                    ActionId = "skip_card",
                    ActionType = "skip_card",
                    Description = "Skip card reward selection",
                });
            }
            obs.Room = roomObs;
        }
        else if (phase == "rewards")
        {
            var roomObs = new RoomObservationDto { RoomType = "Rewards" };
            if (contextObject is IEnumerable<object> rewards)
            {
                int idx = 0;
                foreach (var r in rewards)
                {
                    string rewardType = r.GetType().Name.Replace("Reward", "");
                    roomObs.Options.Add($"{idx}:{rewardType}");
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_reward:{idx}:{rewardType}",
                        ActionType = "choose_reward",
                        Description = $"Claim {rewardType} reward",
                        Metadata = new Dictionary<string, object?> { ["reward_index"] = idx, ["reward_type"] = rewardType }
                    });
                    idx++;
                }

            }

            legalActions.Add(new LegalActionDto
            {
                ActionId = "proceed",
                ActionType = "proceed",
                Description = "Proceed to next screen / room",
            });
            obs.Room = roomObs;
        }
        else if (phase == "rest_site")
        {
            var roomObs = new RoomObservationDto { RoomType = "RestSite" };
            if (contextObject is IReadOnlyList<RestSiteOption> restOptions)
            {
                for (int i = 0; i < restOptions.Count; i++)
                {
                    RestSiteOption opt = restOptions[i];
                    string key = opt.OptionId;
                    roomObs.Options.Add(key);
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_rest:{key}",
                        ActionType = "choose_rest",
                        Description = $"Rest Site Option: {key}",
                        Metadata = new Dictionary<string, object?> { ["option_key"] = key }
                    });
                }
            }
            obs.Room = roomObs;
        }
        else if (phase == "deck_upgrade")
        {
            var roomObs = new RoomObservationDto { RoomType = "DeckUpgrade" };
            if (contextObject is IReadOnlyList<CardModel> upgradableCards)
            {
                for (int i = 0; i < upgradableCards.Count; i++)
                {
                    CardModel card = upgradableCards[i];
                    roomObs.Options.Add(card.Id.Entry);
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_upgrade:{i}:{card.Id.Entry}",
                        ActionType = "choose_upgrade",
                        Description = $"Upgrade {card.Id.Entry}",
                        Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["card_id"] = card.Id.Entry }
                    });
                }
            }
            obs.Room = roomObs;
        }
        else if (phase == "card_select" && contextObject is CardSelectContext select)
        {
            // spire-jev: a card selection the game asked its selector for (CardSelectBridge).
            var roomObs = new RoomObservationDto { RoomType = "CardSelect" };
            roomObs.Details["purpose"] = select.Purpose;
            roomObs.Details["min"] = select.MinSelect;
            roomObs.Details["max"] = select.MaxSelect;
            roomObs.Details["cards"] = select.Cards.Select((c, i) => DescribeCard(c, i, false)).ToList();
            for (int i = 0; i < select.Cards.Count; i++)
            {
                CardModel card = select.Cards[i];
                roomObs.Options.Add(card.Id.Entry);
                legalActions.Add(new LegalActionDto
                {
                    ActionId = $"choose_card_select:{i}:{card.Id.Entry}",
                    ActionType = "choose_card_select",
                    Description = $"Select {card.Id.Entry} ({select.Purpose})",
                    Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["card_id"] = card.Id.Entry, ["upgrades"] = card.CurrentUpgradeLevel }
                });
            }
            obs.Room = roomObs;
        }
        else if (phase == "deck_card_select" || phase == "simple_card_select")
        {
            var roomObs = new RoomObservationDto { RoomType = "DeckCardSelect" };
            if (contextObject is IReadOnlyList<CardModel> selectableCards)
            {
                for (int i = 0; i < selectableCards.Count; i++)
                {
                    CardModel card = selectableCards[i];
                    roomObs.Options.Add(card.Id.Entry);
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_card_select:{i}:{card.Id.Entry}",
                        ActionType = "choose_card_select",
                        Description = $"Select {card.Id.Entry}",
                        Metadata = new Dictionary<string, object?> { ["card_index"] = i, ["card_id"] = card.Id.Entry }
                    });
                }
            }
            obs.Room = roomObs;
        }
        else if (phase == "shop")
        {
            var roomObs = new RoomObservationDto { RoomType = "Shop" };
            if (contextObject is IEnumerable<object> merchantEntries)
            {
                int idx = 0;
                var shopCards = new Dictionary<string, object?>();
                roomObs.Details["cards"] = shopCards;
                foreach (var entry in merchantEntries)
                {
                    if (entry is MerchantCardEntry { CreationResult.Card: { } offered })
                    {
                        try { shopCards[idx.ToString()] = DescribeCard(offered, idx, false); } catch { }
                    }
                    string entryType = entry.GetType().Name.Replace("MerchantEntry", "");
                    string itemId = entry switch
                    {
                        MerchantCardEntry cardEntry => cardEntry.CreationResult?.Card?.Id.Entry ?? "UNKNOWN_CARD",
                        MerchantRelicEntry relicEntry => relicEntry.Model?.Id.Entry ?? "UNKNOWN_RELIC",
                        MerchantPotionEntry potionEntry => potionEntry.Model?.Id.Entry ?? "UNKNOWN_POTION",
                        _ => entryType,
                    };
                    int? price = entry is MerchantEntry merchantEntry ? merchantEntry.Cost : null;
                    bool affordable = entry is not MerchantEntry pricedEntry || pricedEntry.EnoughGold;
                    bool stocked = entry is not MerchantEntry stockEntry || stockEntry.IsStocked;
                    roomObs.Options.Add($"{idx}:{entryType}:{itemId}:{price}");
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"shop_buy:{idx}:{entryType}",
                        ActionType = "shop_buy",
                        Description = $"Buy {itemId} ({entryType}) for {price} gold",
                        Metadata = new Dictionary<string, object?>
                        {
                            ["slot_index"] = idx,
                            ["entry_type"] = entryType,
                            ["item_id"] = itemId,
                            ["price"] = price,
                            ["affordable"] = affordable,
                            ["stocked"] = stocked,
                        }
                    });
                    idx++;
                }
            }

            legalActions.Add(new LegalActionDto
            {
                ActionId = "shop_leave",
                ActionType = "shop_leave",
                Description = "Leave merchant shop",
            });
            obs.Room = roomObs;
        }
        else if (phase == "event")
        {
            var roomObs = new RoomObservationDto { RoomType = "Event" };
            // spire-jev: which event, and what each option says and does.
            try
            {
                var room = RunManager.Instance?.DebugOnlyGetState()?.BaseRoom as EventRoom;
                roomObs.Details["event_id"] = room?.CanonicalEvent?.Id.Entry;
            }
            catch { }
            var described = new List<Dictionary<string, object?>>();
            roomObs.Details["options"] = described;
            if (contextObject is IEnumerable<object> eventOptions)
            {
                int idx = 0;
                foreach (var opt in eventOptions)
                {
                    if (opt is EventOption option)
                    {
                        var d = new Dictionary<string, object?> { ["index"] = idx };
                        try { d["text_key"] = option.TextKey; } catch { }
                        try { d["title"] = option.Title?.GetFormattedText(); } catch { }
                        try { d["description"] = option.Description?.GetFormattedText(); } catch { }
                        try { d["locked"] = option.IsLocked; d["proceed"] = option.IsProceed; } catch { }
                        try { d["relic"] = option.Relic?.Id.Entry; } catch { }
                        try { if (player is not null && option.WillKillPlayer is not null) d["kills"] = option.WillKillPlayer(player); } catch { }
                        described.Add(d);
                    }
                    roomObs.Options.Add(idx.ToString());
                    legalActions.Add(new LegalActionDto
                    {
                        ActionId = $"choose_event:{idx}",
                        ActionType = "choose_event",
                        Description = $"Choose event option {idx}",
                        Metadata = new Dictionary<string, object?> { ["option_index"] = idx }
                    });
                    idx++;
                }
            }

            legalActions.Add(new LegalActionDto
            {
                ActionId = "proceed",
                ActionType = "proceed",
                Description = "Proceed with event",
            });
            obs.Room = roomObs;
        }
        else if (phase == "treasure")
        {
            var roomObs = new RoomObservationDto { RoomType = "Treasure" };
            legalActions.Add(new LegalActionDto
            {
                ActionId = "proceed",
                ActionType = "proceed",
                Description = "Open chest, collect relics and proceed",
            });
            obs.Room = roomObs;
        }
        else if (phase == "victory" || phase == "game_over")
        {
            var roomObs = new RoomObservationDto { RoomType = phase == "victory" ? "Victory" : "GameOver" };
            legalActions.Add(new LegalActionDto
            {
                ActionId = "proceed",
                ActionType = "proceed",
                Description = phase == "victory" ? "Victory! Proceed to next Act" : "Game Over",
            });
            obs.Room = roomObs;
        }

        obs.StateHash = ComputeHash(obs);
        return (obs, legalActions);
    }

    private static string ComputeHash(ObservationDto obs)
    {
        string json = JsonSerializer.Serialize(obs, JsonOptions);
        byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }
}
