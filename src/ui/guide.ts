import { CRYSTAL_HP, CRYSTALS_TO_WIN, DECK_SIZE, MAX_ENERGY } from '../engine/rules';

/** The "How to play" overlay, shown from the menu and from the in-game ? button. */
export function renderGuide(): string {
  return `
    <div class="overlay guide-overlay" data-action="close-guide">
      <div class="dialog guide" data-stop>
        <div class="guide-head">
          <h2>How to play</h2>
          <button class="secondary small-btn" data-action="close-guide">Close ✕</button>
        </div>

        <section>
          <h3>🎯 Goal</h3>
          <p>Each player has <b>3 crystals</b> (${CRYSTAL_HP} HP each), one behind each lane.
          Destroy <b>${CRYSTALS_TO_WIN}</b> of your rival's crystals to win.</p>
        </section>

        <section>
          <h3>🗺️ The board</h3>
          <p>There are 3 lanes: left, middle and right. In each lane you have a <b>front</b> slot and a <b>back</b> slot,
          plus room for one face-down <b>trap</b> and one <b>relic</b>.</p>
          <div class="guide-diagram">
            <div class="gd-row enemy"><span>💎</span><span>💎</span><span>💎</span></div>
            <div class="gd-row enemy"><span>back</span><span>back</span><span>back</span></div>
            <div class="gd-row enemy"><span>front</span><span>front</span><span>front</span></div>
            <div class="gd-divider">⚔️ creatures attack the lane straight ahead ⚔️</div>
            <div class="gd-row"><span>front</span><span>front</span><span>front</span></div>
            <div class="gd-row"><span>back</span><span>back</span><span>back</span></div>
            <div class="gd-row"><span>💎</span><span>💎</span><span>💎</span></div>
          </div>
        </section>

        <section>
          <h3>⚡ Your turn</h3>
          <ol>
            <li>You get energy equal to your turn number (up to ${MAX_ENERGY}) and draw a card.</li>
            <li><b>Play cards</b> by spending energy: creatures, spells, relics and traps.</li>
            <li><b>Attack</b> with your creatures. Once you attack, you can't play more cards this turn.</li>
            <li>Click <b>End turn</b>.</li>
          </ol>
          <p>The player who goes first skips their first draw and can't attack on their first turn.</p>
        </section>

        <section>
          <h3>💪 Power Level</h3>
          <p>A creature's big number is its <b>Power Level (PL)</b>. It is both how hard it hits and how much damage it can take.
          Damage lowers it permanently, so a hurt creature also hits weaker.</p>
        </section>

        <section>
          <h3>⚔️ Attacking</h3>
          <ul>
            <li>New creatures <b>can't attack on the turn they're played</b>, unless they have <b>Rush</b>.</li>
            <li>Only <b>front-row</b> creatures attack, unless a back-row creature has <b>Ranged</b>.</li>
            <li>Damage flows <b>front creature → back creature → crystal</b>. Any damage beyond what a creature can take
            <b>overflows</b> to the next one.</li>
            <li>An empty lane means the attack hits the crystal directly.</li>
          </ul>
        </section>

        <section>
          <h3>🛡️ Stances: Guard and Exposed</h3>
          <p>Every creature shows a stance badge:</p>
          <ul>
            <li><span class="stance guard">Guard</span> The creature held back, so if it's attacked, <b>it strikes first</b>.
            New creatures start on Guard.</li>
            <li><span class="stance exposed">Exposed</span> It attacked on its last turn, so <b>attackers strike it first</b>
            until its next turn.</li>
          </ul>
          <p>Whoever strikes second hits back with whatever Power Level it has left, and a creature that's destroyed first deals nothing.
          So each turn you choose: attack now and be Exposed, or hold back and stay on Guard.</p>
          <p class="tip">💡 Select one of your creatures and hover over an enemy lane to see exactly what an attack would do.</p>
        </section>

        <section>
          <h3>⬆️ Evolution</h3>
          <p>Cards marked <span class="ribbon evolve">⬆ Evolution</span> are played on top of one of your creatures of the same
          type and one star lower, e.g. a 2★ Goblin Chief onto any 1★ Goblin. You can evolve the turn a creature is played,
          but each creature only once per turn. Damage carries over.</p>
          <p><span class="ribbon legend">👑 Legendary</span> 3★ cards are played directly, without evolving.</p>
        </section>

        <section>
          <h3>🔗 Synergy</h3>
          <p>Some creatures get a bonus when the other creature in the <b>same lane</b> is the same type or the type
          it works with: Goblin → Beast → Elemental → Undead → Knight → Goblin.</p>
        </section>

        <section>
          <h3>✨ Spells, relics and traps</h3>
          <ul>
            <li><b>Spells</b> take effect once, then are discarded.</li>
            <li><b>Relics</b> stay in play, attached to a creature or a lane.</li>
            <li><b>Traps</b> are set face-down in a lane and spring automatically when their condition happens.
            Your rival can see that a trap is there, but not which one.</li>
          </ul>
        </section>

        <section>
          <h3>🏷️ Keywords</h3>
          <dl class="keywords">
            <dt>Rush</dt><dd>Can attack the turn it's played.</dd>
            <dt>Ranged</dt><dd>Can attack from the back row, and is never hit back when it does.</dd>
            <dt>Shield</dt><dd>Blocks the first hit completely.</dd>
            <dt>Pierce</dt><dd>Overflow skips the back creature and goes straight to the crystal.</dd>
            <dt>First Strike</dt><dd>Always strikes first when attacking, even against a creature on Guard.</dd>
          </dl>
        </section>

        <section>
          <h3>💥 Destroyed crystals</h3>
          <p>A destroyed crystal's lane stays in play. Enemy creatures there must get past yours first. If your side of the
          lane is empty, they can attack a neighbouring lane instead.</p>
        </section>

        <section>
          <h3>🥀 Running out of cards</h3>
          <p>Decks have ${DECK_SIZE} cards. If you need to draw from an empty deck, your weakest crystal takes damage instead,
          a little more each time.</p>
        </section>
      </div>
    </div>`;
}
