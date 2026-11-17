import type { Season, Weather } from '../game/types';

/** Where a villager stands from a given minute of the day. The last matching stop at or before the time wins. */
export interface Stop {
  from: number;
  /** null means indoors, out of sight. */
  map: string | null;
  x: number;
  y: number;
  dir?: 'down' | 'up' | 'left' | 'right';
  /** Only when the weather is one of these. */
  weather?: readonly Weather[];
  /** Only on these weekdays (0 is Monday). */
  days?: readonly number[];
}

export interface Unlock {
  hearts: number;
  /** What they say the first time you reach this friendship. */
  text: string;
  recipe?: string;
  item?: { id: string; n: number };
  flag?: string;
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  birthday: { season: Season; day: number };
  loves: readonly string[];
  likes: readonly string[];
  dislikes: readonly string[];
  stops: readonly Stop[];
  intro: string;
  /** Said at 0-1 hearts, 2-5 hearts, and 6+ hearts. */
  talk: readonly [readonly string[], readonly string[], readonly string[]];
  bySeason: Readonly<Record<Season, string>>;
  byWeather: Partial<Record<Weather, string>>;
  birthdayLine: string;
  gift: { love: string; like: string; neutral: string; dislike: string };
  unlocks: readonly Unlock[];
}

const H = 60;
const rainy: readonly Weather[] = ['rain', 'storm', 'snow'];

export const NPCS: readonly NpcDef[] = [
  {
    id: 'mirren', name: 'Mirren', role: 'Runs the General Store',
    birthday: { season: 'spring', day: 12 },
    loves: ['tulip', 'strawberry', 'dish-pie'], likes: ['radish', 'potato', 'loaf', 'flower', 'dish-jam'], dislikes: ['weed', 'coal', 'clay'],
    stops: [
      { from: 6 * H, map: null, x: 0, y: 0 },
      { from: 9 * H, map: 'village', x: 6, y: 12, dir: 'up' },
      { from: 9 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 18 * H, map: null, x: 0, y: 0 },
    ],
    intro: "Oh! You must be the new farmer. I'm Mirren. The store is mine. Seeds, supplies, and gossip, in that order.",
    talk: [
      ['Early frost is rare here, but I always check the sky anyway.', 'Radishes first. Trust me. They forgive almost anything.', 'Come by whenever you need seeds. Door is open from nine.'],
      ['I saved you the good tomato stakes. Do not tell the others.', 'Busy day? The best ones are the tired ones.', 'People talk about your farm now. Good things, mostly.'],
      ['I do not say this to everyone: the valley is brighter with you in it.', 'Take a loaf for the road. Do not argue. I will win.', 'When the lanterns are lit again, I want the first one to be yours.'],
    ],
    bySeason: {
      spring: 'Spring means new stock! Everything smells like turned earth.',
      summer: 'Summer. Keep your can full and your hat on.',
      fall: 'Pumpkins and pies. If you grow it, I will find a way to put it in a pie.',
      winter: 'Slow season. Good for reading seed catalogues by the stove.',
    },
    byWeather: { rain: 'Rain is free watering. Enjoy the day off.', storm: 'Stay indoors if you can. The thunder is loud tonight.', snow: 'Snow! Mind the ice on the steps.' },
    birthdayLine: 'You remembered my birthday? Oh, now I might cry into the cash drawer.',
    gift: { love: 'This is perfect! I am going to put it where everyone can see.', like: 'How thoughtful. Thank you!', neutral: 'Oh, thank you. That is kind of you.', dislike: 'Um. Thank you. I think.' },
    unlocks: [
      { hearts: 2, text: 'You have been so friendly. Here, a sprinkler plan I found in the back. Bram can help you with the metal.', recipe: 'sprinkler' },
      { hearts: 5, text: 'Here, a little extra for the trouble of walking all the way here. Good luck out there.', item: { id: 'loaf', n: 5 } },
    ],
  },
  {
    id: 'bram', name: 'Bram', role: 'The blacksmith',
    birthday: { season: 'fall', day: 3 },
    loves: ['coal', 'dish-stew', 'goldBar'], likes: ['copperBar', 'ironBar', 'egg', 'dish-soup', 'wheat'], dislikes: ['flower', 'berry', 'dish-jam'],
    stops: [
      { from: 6 * H, map: null, x: 0, y: 0 },
      { from: 9 * H, map: 'village', x: 37, y: 11, dir: 'up' },
      { from: 9 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 17 * H, map: 'village', x: 13, y: 12, dir: 'down' },
      { from: 17 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 21 * H, map: null, x: 0, y: 0 },
    ],
    intro: 'Bram. Smithy. I fix tools. I do not talk much. But you can.',
    talk: [
      ['Good steel takes patience.', 'Hm. You hold that hoe wrong. Here, like this. See?', 'Ore is in the old quarry. Bring coal too.'],
      ['The forge likes company. Stay a minute.', 'Ida says I should smile more. I am smiling. This is it.', 'Copper first, then iron. Do not rush the tools.'],
      ['I made something for you once. I will not say what. You will find out.', 'Tools are only half of it. The hands matter more.', 'I like how the village sounds now. Warmer.'],
    ],
    bySeason: {
      spring: 'The forge is a good place to wait out the mud.',
      summer: 'Hot out. Hotter in here. I do not mind.',
      fall: 'Best weather for the work. My birthday is soon. Not that it matters.',
      winter: 'Cold keeps the metal honest.',
    },
    byWeather: { rain: 'Rain on the roof. Best sound there is, with the fire going.', snow: 'Snow. Watch your boots.' },
    birthdayLine: '...You remembered. Hm. Thanks. Really.',
    gift: { love: 'This is... exactly right. Thank you. Really.', like: 'Good. Useful. Thanks.', neutral: 'Hm. Thanks.', dislike: '...I will find somewhere to put it.' },
    unlocks: [
      { hearts: 2, text: 'Take this. A scrap of copper bar. For your first sprinkler.', item: { id: 'copperBar', n: 1 } },
      { hearts: 4, text: 'I can make your tools stronger now. Bring metal and gold and I will do it in two days. Talk to me when you are ready.', flag: 'forge' },
    ],
  },
  {
    id: 'ida', name: 'Ida', role: 'Owns the Cafe',
    birthday: { season: 'summer', day: 20 },
    loves: ['dish-pie', 'dish-jam', 'strawberry', 'melon'], likes: ['egg', 'tomato', 'dish-tea', 'blueberry', 'loaf'], dislikes: ['stone', 'fiber', 'coal'],
    stops: [
      { from: 6 * H, map: null, x: 0, y: 0 },
      { from: 8 * H, map: 'village', x: 15, y: 12, dir: 'down' },
      { from: 8 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 20 * H, map: null, x: 0, y: 0 },
    ],
    intro: "Welcome! Ida, cafe, best pie in three valleys. If the other two valleys argue, they are wrong.",
    talk: [
      ['Fresh bread at eight, fresh gossip all day.', 'Nobody cooks alone here. Not for long, anyway.', 'You look hungry. Nobody should farm on an empty stomach.'],
      ['Come by when you have extra eggs. I will make it worth the walk.', 'The secret to a good soup is time. And onions. Mostly time.', 'I have been teaching Bram to smile with his eyes. It is going slowly.'],
      ['Your crops make my menu better. I think about that when I wake up.', 'Sit. Eat. Talk. That is the whole plan.', 'The cafe is full of stories. I would love to hear yours.'],
    ],
    bySeason: {
      spring: 'Spring greens in everything this week!',
      summer: 'Cold drinks and warm gossip. Perfect weather for both.',
      fall: 'Pumpkin everything. Do not ask. Just say yes.',
      winter: 'Hot tea, warm soup. Come in from the cold.',
    },
    byWeather: { rain: 'Rainy days are soup days. Always.', snow: 'Snow! Come in, I have tea on.' },
    birthdayLine: 'My birthday cake from you? Oh, I will have to compete with myself now.',
    gift: { love: 'Oh my goodness! This is wonderful!', like: 'You are too sweet. Thank you!', neutral: 'Thank you, dear. I will find a use.', dislike: 'Oh. That is... something. Thank you.' },
    unlocks: [
      { hearts: 2, text: 'Here is a recipe my gran gave me. Fresh, simple, and it keeps you going. Try it on the stove at home.', recipe: 'soup' },
      { hearts: 3, text: 'You like soup? Wait until you try this. A hearty stew recipe, just for you.', recipe: 'stew' },
      { hearts: 5, text: 'And this one is my secret. Do not tell Mirren. It is pie.', recipe: 'pie' },
    ],
  },
  {
    id: 'tam', name: 'Old Tam', role: 'Keeps the lake',
    birthday: { season: 'winter', day: 9 },
    loves: ['koi', 'eel', 'dish-stew'], likes: ['trout', 'carp', 'perch', 'dish-tea'], dislikes: ['mushroom', 'fiber'],
    stops: [
      { from: 6 * H, map: 'lake', x: 12, y: 13, dir: 'right' },
      { from: 6 * H, map: null, x: 0, y: 0, weather: ['storm'] },
      { from: 18 * H, map: 'village', x: 28, y: 19, dir: 'down' },
      { from: 18 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 22 * H, map: null, x: 0, y: 0 },
    ],
    intro: 'Mm. Another fisher? Pull up a log. The fish are polite. They come when they are ready.',
    talk: [
      ['Patience. That is the whole trick.', 'The lake remembers everyone who sits beside it.', 'You cast like you are mad at the water. Do not be mad at the water.'],
      ['The big ones bite at dawn and dusk. When the world is gold.', 'Rain changes the fish. Rain changes everything, if you let it.', 'My knees tell me the weather. They have never been wrong. Rude of them.'],
      ['Forty years I have fished this lake. I have yet to be bored.', 'There is a silver koi out there. I have seen her twice. She is not for catching. Mostly.', 'Sit with me. The quiet is better shared.'],
    ],
    bySeason: {
      spring: 'Spring fish are shy. Be gentle.',
      summer: 'Summer trout are fast. Keep your wrists loose.',
      fall: 'Fall is eel season. Dusk, rain, and patience.',
      winter: 'Ice at the edges. The fish go deep. So do I, in my thoughts.',
    },
    byWeather: { rain: 'Good fishing in the rain. Do not tell anyone.', storm: 'Not even I fish in this.', snow: 'Quiet day. Warm hat. Cold line. Perfect.' },
    birthdayLine: 'A gift for an old man? Well, now. That is the best kind of day.',
    gift: { love: 'Ha! Now this is a gift. You have good taste, friend.', like: 'Kind of you. Very kind.', neutral: 'Thank you. I will think of you when I eat it.', dislike: 'Hmph. Well. It is the thought.' },
    unlocks: [
      { hearts: 0, text: 'A good fisher needs a good line. Take this rod. It served me well for years. Treat it kindly.', item: { id: 'rod', n: 1 } },
      { hearts: 2, text: 'Tea for the long waits. Patience goes better with something warm.', item: { id: 'dish-tea', n: 3 } },
      { hearts: 5, text: 'I have taught you what I know. The rest is time and water. Your hands will keep the line steady now.', flag: 'tam-5' },
    ],
  },
  {
    id: 'wren', name: 'Wren', role: 'Forager and wanderer',
    birthday: { season: 'spring', day: 24 },
    loves: ['mushroom', 'berry', 'flower', 'sap'], likes: ['tulip', 'sunflower', 'dish-salad', 'dish-tea', 'clay'], dislikes: ['coal', 'goldOre', 'loaf'],
    stops: [
      { from: 6 * H, map: 'forest', x: 14, y: 22, dir: 'down' },
      { from: 14 * H, map: 'village', x: 21, y: 17, dir: 'right' },
      { from: 19 * H, map: null, x: 0, y: 0 },
      { from: 6 * H, map: 'village', x: 21, y: 17, dir: 'right', weather: ['rain'] },
    ],
    intro: 'Oh, hello! Careful, you are standing on a very polite patch of moss. I am Wren. I follow my feet.',
    talk: [
      ['Mushrooms grow where the forest is damp and quiet.', 'Everything in the woods has its hour. You just have to be there.', 'I measure the day by what is in bloom.'],
      ['The north path has berries after the rain. Do not tell the squirrels.', 'I found a clearing yesterday. It was humming. I do not know why.', 'If you stand still, the forest forgets you are there. Try it.'],
      ['I have never stayed anywhere this long. I think I like it. Do not tell my feet.', 'You smell like earth and sunshine. Compliment. Probably.', 'The lanterns will bring the fireflies back. I am sure of it.'],
    ],
    bySeason: {
      spring: 'Everything is waking up. I can hear it. Listen!',
      summer: 'Summer evenings in the forest. Fireflies if you are lucky.',
      fall: 'The leaves! Every one a different goodbye.',
      winter: 'The forest is asleep. Tiptoe.',
    },
    byWeather: { rain: 'Rain! The whole forest smells like a secret.', storm: 'The thunder is just the sky clearing its throat.', snow: 'Quiet snow. It hushes everything.' },
    birthdayLine: 'For me?! Nobody has ever... oh. Thank you. I will remember this all year.',
    gift: { love: 'This is the best thing! Look at it! Look!', like: 'Oh, lovely! Thank you!', neutral: 'Thank you! I am sure I will find something wonderful to do with it.', dislike: 'Oh. Hm. I will find it a good home. Somewhere.' },
    unlocks: [
      { hearts: 2, text: 'I found this on the north path. I think you will like it. Look for the same in the woods.', item: { id: 'mushroom', n: 3 } },
      { hearts: 4, text: 'There is a hidden quiet place by the lake. When you need peace, go there. I would like you to know about it.', flag: 'wren-4' },
    ],
  },
  {
    id: 'olwen', name: 'Olwen', role: 'Keeper of the lanterns',
    birthday: { season: 'fall', day: 24 },
    loves: ['dish-tea', 'sunflower', 'lantern'], likes: ['tulip', 'dish-jam', 'melon', 'blueberry', 'egg'], dislikes: ['weed', 'fiber', 'stone'],
    stops: [
      { from: 6 * H, map: null, x: 0, y: 0 },
      { from: 8 * H, map: 'village', x: 20, y: 15, dir: 'right' },
      { from: 8 * H, map: null, x: 0, y: 0, weather: rainy },
      { from: 19 * H, map: null, x: 0, y: 0 },
    ],
    intro: 'Ah. The farmer. I am Olwen. I keep the lanterns. Once, long ago, the whole valley glowed at night. It can again.',
    talk: [
      ['The shrine remembers every lantern. Even the dark ones.', 'Bring what the valley gave you. It wants to give more.', 'Light is a kind of promise.'],
      ['Each lantern is a thing done well. Not a thing done fast.', 'The old stories say the valley was lit by gratitude. I have always believed it.', 'The fireflies used to follow the lanterns home. Perhaps they will again.'],
      ['I have kept this shrine for fifty years. You are the first to make it feel less lonely.', 'When the last lantern lights, I would like to sit beside you and say nothing at all.', 'You are what the valley was waiting for.'],
    ],
    bySeason: {
      spring: 'The first lantern always goes up in spring. It feels like hope.',
      summer: 'Long days. Short nights. Good for the work.',
      fall: 'My favourite season. The valley turns the colour of lantern light.',
      winter: 'On the longest night, we light them all. Remember that.',
    },
    byWeather: { rain: 'Rain on the shrine roof. Listen. It is almost a song.' },
    birthdayLine: 'A gift. For an old keeper. The valley has been generous with me today.',
    gift: { love: 'Oh. Oh my. This is... precious. Thank you, truly.', like: 'That is lovely. Thank you, dear.', neutral: 'Thank you. That was kind.', dislike: 'Hm. Well. Thank you for thinking of me.' },
    unlocks: [
      { hearts: 3, text: 'I kept this for someone who might need it. A recipe for warm tea. It carries you through the cold.', recipe: 'tea' },
      { hearts: 6, text: 'The valley feels lighter since you came. Here. A thank you.', item: { id: 'goldBar', n: 1 } },
    ],
  },
];

export const NPC_BY_ID: Readonly<Record<string, NpcDef>> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
