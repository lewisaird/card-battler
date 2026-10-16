import type { AIProfile } from './ai';

export type LineKey =
  | 'intro'
  | 'taunt'
  | 'playLegendary'
  | 'evolve'
  | 'trapSprung'
  | 'fellForTrap'
  | 'lostCrystal'
  | 'tookCrystal'
  | 'playerLegendary'
  | 'win'
  | 'lose';

export interface Rival {
  id: string;
  name: string;
  title: string;
  portrait: string;
  deckId: string;
  style: string;
  profile: AIProfile;
  lines: Record<LineKey, string[]>;
}

export const RIVALS: Rival[] = [
  {
    id: 'krag',
    name: 'Krag the Reckless',
    title: 'Goblin Warboss',
    portrait: '👺',
    deckId: 'horde',
    style: 'A gambler who never met a risk he didn’t like. Attacks constantly and makes wild plays.',
    profile: { aggression: 1.5, caution: 0.7, greed: 0.6, setup: 1.5, recklessness: 3 },
    lines: {
      intro: ['Heh! Let’s roll the bones, shall we?', 'Fortune favours the loud! Let’s go!'],
      taunt: ['All in! Always all in!', 'Luck’s on my side today, I can feel it!', 'You call that a play? Watch this!'],
      playLegendary: ['Bow to your king! GRUBNAK!', 'Jackpot! Here comes the big one!'],
      evolve: ['Bigger and meaner!', 'Look at him grow! Hah!'],
      trapSprung: ['Snap! Didn’t see that coming, did ya?', 'Ha! Right into my trap!'],
      fellForTrap: ['Bah! Cheater’s tricks!', 'A trap?! Lucky shot!'],
      lostCrystal: ['Grr! That was my favourite crystal!', 'Fine! I’ve got two more to bet!'],
      tookCrystal: ['SMASH! One down!', 'Did you hear that crack? Beautiful!'],
      playerLegendary: ['Whoa, that’s a big one...', 'Pfft. The bigger they are...'],
      win: ['HA! The dice never lie! I win!', 'Krag wins again! Pay up!'],
      lose: ['Rigged! The whole thing was rigged!', 'Bah! Next time the dice roll my way!'],
    },
  },
  {
    id: 'sylva',
    name: 'Sylva of the Glade',
    title: 'Storm Druid',
    portrait: '🧝',
    deckId: 'wild-storm',
    style: 'Patient and balanced. Grows her beasts, then lets the storm loose.',
    profile: { aggression: 1, caution: 1, greed: 0.9, setup: 2, recklessness: 0.5 },
    lines: {
      intro: ['The forest is watching. Let us begin.', 'Breathe. Listen to the wind. Now, we duel.'],
      taunt: ['Every storm starts as a breeze.', 'Roots run deep. Be patient.', 'The wild does not hurry, yet it always arrives.'],
      playLegendary: ['Rise, ancient one.', 'The earth itself answers my call.'],
      evolve: ['Grow strong, little one.', 'Nature always finds a way to grow.'],
      trapSprung: ['The thicket has thorns.', 'You walked where the ground was soft.'],
      fellForTrap: ['Clever. I did not sense that.', 'Hm. A hunter’s snare.'],
      lostCrystal: ['A branch breaks. The tree remains.', 'The storm will return that favour.'],
      tookCrystal: ['The storm breaks through.', 'Lightning does not strike twice. It does not need to.'],
      playerLegendary: ['A mighty creature. Even mighty trees fall.', 'Impressive. The wild respects strength.'],
      win: ['The cycle turns. Well fought.', 'Return to the glade anytime. You have grown.'],
      lose: ['You fought like the storm itself. I yield.', 'The forest learns from every season. So will I.'],
    },
  },
  {
    id: 'morvane',
    name: 'Morvane the Pale',
    title: 'Necromancer',
    portrait: '🧙',
    deckId: 'ashen-rite',
    style: 'Cold and calculating. Plays the long game, hoarding cards and grinding you down.',
    profile: { aggression: 0.9, caution: 1.1, greed: 1.3, setup: 2, recklessness: 0 },
    lines: {
      intro: ['Another soul for my collection.', 'Time is on my side. It always is.'],
      taunt: ['Everything you destroy, I can use.', 'Struggle all you like.', 'Death is patient. So am I.'],
      playLegendary: ['Behold what lies beneath.', 'From the ashes, something terrible.'],
      evolve: ['Death is merely a transformation.', 'Rise again, stronger.'],
      trapSprung: ['How predictable.', 'You stepped into your own grave.'],
      fellForTrap: ['A crude trick.', 'Noted. It will not happen twice.'],
      lostCrystal: ['A minor setback.', 'Shatter it. I have no need of it.'],
      tookCrystal: ['Your defences crumble like old bone.', 'One step closer to the end.'],
      playerLegendary: ['Interesting. It will make a fine servant once it falls.', 'How large. How temporary.'],
      win: ['As inevitable as nightfall.', 'Your soul is mine. Again.'],
      lose: ['This is not the end. Nothing is ever the end.', 'I will remember this.'],
    },
  },
  {
    id: 'hollow',
    name: 'Sir Hollow',
    title: 'The Knight Who Never Left',
    portrait: '💀',
    deckId: 'vanguard',
    style: 'A knight who died at his post and never left it. Defends every crystal to the last.',
    profile: { aggression: 0.8, caution: 1.5, greed: 0.8, setup: 2.5, recklessness: 0 },
    lines: {
      intro: ['None shall pass. None ever have.', 'I have held this line for three hundred years.'],
      taunt: ['Hold the line.', 'My oath outlived my body. It will outlast you.', 'Steady. Steady.'],
      playLegendary: ['To me, my liege!', 'The old guard rides again.'],
      evolve: ['Rise, and take up the shield.', 'Promoted in the field.'],
      trapSprung: ['A soldier always guards the gate.', 'The defences hold.'],
      fellForTrap: ['An ambush! Reform the ranks!', 'Dishonourable... but effective.'],
      lostCrystal: ['A wall has fallen. I will become the wall.', 'Fall back! Hold the next line!'],
      tookCrystal: ['A breach! Press the advantage!', 'Forward, for the realm!'],
      playerLegendary: ['A worthy foe at last.', 'Steel yourselves, men.'],
      win: ['The line holds. As it always will.', 'Rest now. You fought with honour.'],
      lose: ['At last... I may rest.', 'The line... is broken. Well fought.'],
    },
  },
  {
    id: 'brannoc',
    name: 'Captain Brannoc',
    title: 'Veteran Tactician',
    portrait: '🛡️',
    deckId: 'banner-blade',
    style: 'A tactician who loves traps, relics and a well-timed ambush.',
    profile: { aggression: 1.1, caution: 1.1, greed: 0.8, setup: 3.5, recklessness: 0 },
    lines: {
      intro: ['Study the field before you charge, recruit.', 'Every battle is won before it starts.'],
      taunt: ['Formation is everything.', 'You’re playing checkers. I’m playing chess.', 'Patience. Position. Victory.'],
      playLegendary: ['His Majesty takes the field!', 'Here comes the cavalry.'],
      evolve: ['Promotion earned in battle.', 'Field commission, effective immediately.'],
      trapSprung: ['Exactly as planned.', 'Never charge an unscouted lane.'],
      fellForTrap: ['Well laid. I respect that.', 'Hm. I should have scouted that lane.'],
      lostCrystal: ['A tactical withdrawal.', 'We regroup and counterattack.'],
      tookCrystal: ['Objective secured.', 'The flank collapses. Push on!'],
      playerLegendary: ['Big piece. Let’s see how you use it.', 'Adjusting the plan.'],
      win: ['Good effort, recruit. Back to drills.', 'Victory through preparation.'],
      lose: ['Outmanoeuvred. Well done.', 'You’ve earned your stripes today.'],
    },
  },
];

export function pickLine(rival: Rival, key: LineKey): string {
  const lines = rival.lines[key];
  return lines[Math.floor(Math.random() * lines.length)];
}
