/**
 * The bridge's observation, as JSON — mirrors mod/Bridge/ProtocolMessages.cs.
 * Only the fields the planner reads are typed; the rest pass through.
 */

export interface CardObs {
  index: number;
  card_id: string;
  cost: number;
  current_cost: number;
  costs_x: boolean;
  can_play: boolean;
  target_type: string;
  upgrades: number;
  keywords: string[];
  vars: Record<string, number>;
  card_type: string;
  /** Hand cards: the card glows gold, its condition holds (Spite once you have lost HP this turn). */
  glows?: boolean;
  /** Hand cards: a calculated var's value as the game computes it now. */
  calculated?: Record<string, number>;
  /** An enchantment on the card, and the vars it changed from their base. */
  enchantment?: string;
  enchantment_amount?: number;
  enchanted?: Record<string, number>;
  enchantment_vars?: Record<string, number>;
  /** Hand cards: numbers the card's own class keeps (Thrash's extra damage). */
  fields?: Record<string, number>;
  /** An affliction for this combat: "BOUND" (the Queen's Chains of Binding), and its amount. */
  affliction?: string;
  affliction_amount?: number;
}

export interface IntentObs {
  type: string;
  damage: number;
  hits: number;
}

export interface EnemyObs {
  combat_id: number;
  model_id: string;
  hp: number;
  max_hp: number;
  block: number;
  is_alive: boolean;
  intent: string;
  intents: IntentObs[];
  powers: Record<string, number>;
  /** A power's own numbers beside its amount: Shrink's damage decrease, say. */
  power_vars?: Record<string, Record<string, number>>;
}

export interface CombatObs {
  turn: number;
  hand: CardObs[];
  draw_pile: CardObs[];
  discard_pile: CardObs[];
  exhaust_pile: CardObs[];
  draw_pile_count: number;
  discard_pile_count: number;
  exhaust_pile_count: number;
  max_energy: number;
  enemies: EnemyObs[];
}

export interface Observation {
  phase: string;
  is_terminal: boolean;
  is_victory: boolean;
  seed: string;
  act: number;
  /** The act's boss encounter ("WATERFALL_GIANT_BOSS"), and act 3's second at A10; "" from older bridges. */
  act_boss?: string;
  act_second_boss?: string;
  floor: number;
  gold: number;
  player_hp: number;
  player_max_hp: number;
  player_block: number;
  player_energy: number;
  player_powers: Record<string, number>;
  player_power_vars?: Record<string, Record<string, number>>;
  /** Each relic's numbers and counters: Tuning Fork's skills played so far. */
  relic_vars?: Record<string, Record<string, number>>;
  deck_cards: string[];
  relics: string[];
  potions: string[];
  potion_slots?: number;
  /** The run's ascension, as the game has it. */
  ascension?: number;
  potion_details?: { slot: number; id: string; rarity?: string; target?: string; usage?: string; vars?: Record<string, number> }[];
  combat: CombatObs | null;
  room: { room_type: string; options: string[]; details: Record<string, unknown> } | null;
}

export interface LegalAction {
  action_id: string;
  action_type: string;
  description: string;
  metadata?: Record<string, unknown>;
}
