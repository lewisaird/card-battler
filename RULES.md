# Card Battler — Rules (Draft v0.1)

Working rules for the prototype. Numbers marked *(tune)* are starting values to adjust through play-testing.

---

## 1. Overview

Two players duel across **3 lanes**. Each player has a **crystal** behind each lane. **Destroy 2 of your opponent's 3 crystals to win.**

## 2. Setup

- **Deck:** 30 cards.
- **Crystals:** 3 per player, **30 HP** each *(tune)*.
- **Starting hand:** 5 cards each.
- **Mulligan:** each player may redraw their starting hand once (shuffle it back, draw 5).
- **Hand limit:** 10 cards *(tune)*. Cards drawn beyond this are discarded.

### Going first vs second
- **First player:** does not draw on their first turn and cannot declare an attack on their first turn.
- **Second player:** draws as normal on their first turn (giving them 6 cards).

## 3. The Board

Each player's side has 3 lanes. Each lane has:

| Slot | Holds |
|---|---|
| Front row | 1 creature |
| Back row | 1 creature |
| Trap slot | 1 face-down trap |
| Crystal | 30 HP |

A player can have at most **6 creatures** on the field (2 per lane).

## 4. Energy

- Each player's maximum energy is equal to their **own turn number**, up to a cap of **10**.
- Energy refills to the maximum at the start of each turn. Unspent energy is lost.
- Every card has an energy cost. Evolving, moving creatures and setting traps also cost energy.

## 5. Turn Structure

1. **Start:** energy refills, and any "start of turn" effects trigger.
2. **Draw:** draw 1 card (skipped by the first player on turn 1). If the deck is empty, take **fatigue** damage instead (see section 10).
3. **Main:** in any order, as energy allows:
   - play creatures
   - cast spells and play relics
   - set traps
   - evolve creatures
   - move creatures
4. **Combat:** choose attacks one at a time (see section 6).
5. **End:** "end of turn" effects trigger, then the turn passes.

## 6. Creatures and Combat

### Power Level (PL)
A creature's single **Power Level** is both its attack and its health. Damage reduces PL permanently. A creature at 0 PL is destroyed.

### Playing creatures
- Place the creature in an empty front or back slot in any lane.
- If the front slot is empty and a back creature exists, the back creature **moves up** immediately.
- Creatures **cannot attack on the turn they are played**, unless they have **Rush**. (Play-testing showed that attacking straight away made creatures trade on arrival, so boards never built up.)

### Who can attack
- **Front row** creatures can attack.
- **Back row** creatures cannot attack, unless they have **Ranged**. A Ranged creature takes no retaliation when it attacks **from the back row**; in the front row it is hit back like anyone else.
- Each creature can attack **once per turn**, and only the lane **directly opposite**.
- The player chooses which creatures attack and in what order.

### Stances: Guarding and Exposed
Every creature is either **Guarding** or **Exposed**:
- A creature that **attacked on its owner's last turn** is **Exposed** until its owner's next turn begins. It's off-balance.
- Every other creature is **Guarding**, including creatures that were just played.

Stances decide **who strikes first** when a front creature is attacked:
- **Defender Exposed:** the attacker strikes first. If the defender survives, it hits back with the Power Level it has left.
- **Defender Guarding:** the defender strikes first. If the attacker survives, it then hits with the Power Level it has left. If it doesn't survive, it deals no damage.
- **First Strike:** an attacker with First Strike always strikes first, even against a Guarding defender.
- **Ranged from the back row:** never hit back, whatever the stance.

This makes every turn a choice: attack now and be Exposed on the enemy's turn, or hold back and stay Guarding.

### Resolving an attack
Damage flows through the opposing lane in this order:

**front creature → back creature → crystal**

1. Work out who strikes first (see Stances).
2. The attacker's damage is its PL at the moment it strikes, plus any bonuses. The front defender takes it, and any **overflow** passes to the back creature, then to the crystal.
3. Only the front creature ever strikes the attacker, even if overflow hits the back creature.
4. If the lane is empty, the full damage goes to the crystal, and the attacker takes nothing.

**Example 1 (Exposed defender):** a Great Bear (PL 8) attacks a lane with an Exposed Footman (PL 5) in front and a Wisp (PL 2) behind. The Bear strikes first: the Footman takes 5 and is destroyed, the Wisp takes 2 and is destroyed, and 1 overflows to the crystal. The Footman never hits back, so the Bear stays at PL 8.

**Example 2 (Guarding defender):** the same Bear attacks a Guarding Footman (PL 5). The Footman strikes first, leaving the Bear at PL 3. The Bear then hits for 3, leaving the Footman at PL 2.

### Destroyed crystals
Destroying a crystal removes **only the crystal**. The lane stays in play for both players: you can still play creatures, traps and relics there and attack from it.
- Damage that overflows into a destroyed crystal is lost.
- Enemy creatures in that lane must get through your creatures there first. Only when your side of the lane is **empty** may they attack an **adjacent lane** instead. The left and right lanes are adjacent to the middle lane, and the middle lane is adjacent to both.

### Moving creatures
Once per turn, a creature may move to an empty slot in an adjacent lane for **1 energy** *(tune)*. A creature that moves cannot attack that turn *(tune)*.

## 7. Card Types

| Type | Behaviour |
|---|---|
| **Creature** | Placed on the board. Has PL, a type, and optionally keywords, an ability and a synergy. |
| **Spell** | One-shot effect. Resolves, then goes to the discard pile. |
| **Relic** | Stays on the field, attached to a lane or a creature. |
| **Trap** | Set face-down in a lane's trap slot. Triggers automatically on its condition, then is discarded. |

## 8. Star Levels and Evolution

- Creatures are **1★, 2★ or 3★**.
- 2★ and 3★ creatures are usually **evolutions**, e.g. *Goblin (1★) → Goblin Chief (2★) → Goblin Warlord (3★)*.
- Evolution cards read **"Evolves from any [Type]"** of the star level below, e.g. "Evolves from any 1★ Goblin".

### Evolution rules
- Evolving **costs energy** (the evolution card's cost).
- You can evolve a creature **the turn it is played**, if you have the energy. Energy is the limit: a 1★ plus its 2★ costs about 4, so turn 4 at the earliest.
- Each creature can evolve **only once per turn** (no 1★ → 3★ in a single turn).
- The evolution card is placed on top of the creature in the same slot.
- **Damage carries over:** the new PL is the evolution's base PL minus damage already taken.
- An evolved creature **can attack** that turn if the creature it evolved from could have attacked.
- Some rare cards may also require the creature to have **survived a combat** before evolving.

### Standalone 3★ legendaries
A small number of 3★ creatures can be played directly, without an evolution line, at a high energy cost.

## 9. Types and Synergy

Five placeholder creature types: **Goblin, Undead, Elemental, Knight, Beast.**

### Synergy
- A creature's synergy is active while the **other creature in the same lane** is the **same type** or a **complementary type**.
- Since each lane holds two creatures, synergy pairs a front creature with its back-row support.

### Complement wheel *(placeholder)*
Each type complements the next:

**Goblin → Beast → Elemental → Undead → Knight → Goblin**

## 10. Deck-Out (Fatigue)

If a player must draw with an empty deck, their **weakest crystal** (lowest HP) takes fatigue damage instead: 1 the first time, 2 the second, 3 the third, and so on. This guarantees every game ends, so there is no turn limit.

## 11. Traps

- Each lane has **1 trap slot** per player.
- Setting a trap costs energy and happens during your Main phase.
- The opponent can see **that** a trap is set in a lane, but not **which** trap.
- Traps trigger automatically on their condition, for example:
  - *Pitfall:* when an enemy creature attacks this lane, deal 3 damage to it.
  - *Ambush:* when an enemy creature is played in this lane, destroy it if its PL is 3 or less.
- A trap cannot trigger on the turn it is set *(tune)*.

## 12. Keywords (starter set)

| Keyword | Effect |
|---|---|
| **Rush** | Can attack the turn it is played. |
| **Ranged** | Can attack from the back row. Takes no retaliation when attacking from the back row. |
| **Shield** | Blocks the first hit completely (including overflow), then loses Shield. |
| **Pierce** | Overflow damage skips the back creature and goes straight to the crystal. |
| **First Strike** | Always strikes first when attacking, even against a Guarding defender. |

## 13. Winning

You win the moment your opponent has **2 crystals destroyed**. If both players would lose at the same time, the **active player wins** *(tune)*.

---

## Open Questions

- Card list: a starter set of about 40 cards (8 per type) plus spells, relics and traps.
- AI rivals: personalities and themed decks.
- Card packs and unlocks: after the prototype.
