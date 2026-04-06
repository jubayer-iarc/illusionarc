import { PLACEHOLDER_IMG } from '@/utils/media'

export type GameBuildType = 'html' | 'webgl' | 'iframe'

export type ArcadeGame = {
  name: string
  slug: string
  thumbnail: string
  shortPitch: string
  description?: string
  controls: string[]
  buildType: GameBuildType
  sourceUrl: string
  embedAllowed: boolean
  embed: {
    aspectRatio?: string
    minHeight?: number
    orientation?: 'any' | 'portrait' | 'landscape'
  }
  leaderboard: boolean
  rating?: { value: number; count: number }
  genre?: 'Arcade' | 'Puzzle' | 'Runner' | 'Shooter' | 'Casual'
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  featured?: boolean
  estTime?: string
  pro?: boolean
}

export const GAMES: ArcadeGame[] = [
  {
    name: 'সালামি রাশ',
    slug: 'salami-rush',
    thumbnail: '/img/salami-rush/salami-rush-thumbnail.jpg',
    shortPitch: 'মিউজিকের তালে দ্রুত ডজ করে বসের আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকার রিদম-ভিত্তিক অ্যাকশন গেম।',
    description:
      'সালামি রাশ হলো একটি দ্রুতগতির রিদম-ভিত্তিক অ্যাকশন গেম, যেখানে আপনাকে মিউজিকের তালে তালে একের পর এক শক্তিশালী বসের মুখোমুখি হতে হবে। নিয়ন আলোর যুদ্ধক্ষেত্রে বসের ছোড়া বুলেট ও আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকাই আপনার মূল লক্ষ্য। খেলার মাঝে Slow Mo, Shield ও Magnet-এর মতো পাওয়ার-আপ সংগ্রহ করে সাময়িক সুবিধা নিতে পারবেন। পাশাপাশি যত বেশি সম্ভব কয়েন সংগ্রহ করে নিজের স্কোর আরও বাড়িয়ে নিতে হবে। লাইভ টুর্নামেন্ট চলাকালীন সর্বোচ্চ স্কোর করেই লিডারবোর্ডে উপরের দিকে উঠে আসতে হবে।',
    controls: [
      'মোবাইল/ট্যাব: স্ক্রিনের বাম বা ডান পাশে টাচ করে দ্রুত ডজ করুন।',
      'কিবোর্ড: Left Arrow / Right Arrow চেপে ডানে-বামে সরুন।',
      'বসের বুলেট ও আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকুন।',
      'পাওয়ার-আপ সংগ্রহ করুন: Slow Mo, Shield, Magnet।',
      'যত বেশি সম্ভব কয়েন সংগ্রহ করুন।'
    ],
    buildType: 'iframe',
    sourceUrl: '/games/salami-rush/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'portrait' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '৬০ সেকেন্ড',
    pro: false
  },
  {
    name: 'সালামি রাশ প্র্যাকটিস ভার্সন',
    slug: 'salami-rush-practice',
    thumbnail: '/img/salami-rush-practice/salami-rush-practice-thumbnail.jpg',
    shortPitch: 'মিউজিকের তালে দ্রুত ডজ করে বসের আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকার রিদম-ভিত্তিক অ্যাকশন গেম।',
    description:
      'সালামি রাশ হলো একটি দ্রুতগতির রিদম-ভিত্তিক অ্যাকশন গেম, যেখানে আপনাকে মিউজিকের তালে তালে একের পর এক শক্তিশালী বসের মুখোমুখি হতে হবে। নিয়ন আলোর যুদ্ধক্ষেত্রে বসের ছোড়া বুলেট ও আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকাই আপনার মূল লক্ষ্য। খেলার মাঝে Slow Mo, Shield ও Magnet-এর মতো পাওয়ার-আপ সংগ্রহ করে সাময়িক সুবিধা নিতে পারবেন। পাশাপাশি যত বেশি সম্ভব কয়েন সংগ্রহ করে নিজের স্কোর আরও বাড়িয়ে নিতে হবে। লাইভ টুর্নামেন্ট চলাকালীন সর্বোচ্চ স্কোর করেই লিডারবোর্ডে উপরের দিকে উঠে আসতে হবে।',
    controls: [
      'মোবাইল/ট্যাব: স্ক্রিনের বাম বা ডান পাশে টাচ করে দ্রুত ডজ করুন।',
      'কিবোর্ড: Left Arrow / Right Arrow চেপে ডানে-বামে সরুন।',
      'বসের বুলেট ও আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকুন।',
      'পাওয়ার-আপ সংগ্রহ করুন: Slow Mo, Shield, Magnet।',
      'যত বেশি সম্ভব কয়েন সংগ্রহ করুন।'
    ],
    buildType: 'iframe',
    sourceUrl: '/games/salami-rush-practice/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'portrait' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '৬০ সেকেন্ড',
    pro: false
  },
  {
    name: 'Boss Rush',
    slug: 'boss-rush',
    thumbnail: '/img/boss-rush/boss-rush-thumbnail.png',
    shortPitch: 'A fast-paced neon bullet-hell where you dodge, react, and survive endless boss battles to the rhythm.',
    description:
      'Boss Rush: Neon Arena throws you into a pulse-pounding synthwave battlefield where every second tests your reflex. Face relentless bosses, dodge cinematic attacks, and master rhythm-driven survival with minimal controls. Experience glowing visuals, adaptive difficulty, and fast, intense gameplay built for quick mobile sessions. Survive. Adapt. Repeat.',
    controls: [
      'Tap / click left or right to dodge (quick dash).',
      'Keyboard: Left Arrow / Right Arrow — dodge left/right.',
      'Dodge boss bullets and survive as long as possible.',
      'Collect power-ups: Slow Mo, Shield, Magnet (temporary boosts).',
      'Collect as many coins as you can.'
    ],
    buildType: 'iframe',
    sourceUrl: '/games/boss-rush/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s',
    pro: false
  },
  {
    name: 'Blink Maze',
    slug: 'blink-maze',
    thumbnail: '/img/blink-maze/blink-maze-thumbnail.jpeg',
    shortPitch: 'Teleport, solve, and escape shifting mazes in a fast-thinking reflex puzzle.',
    description:
      'Blink Maze challenges your mind with teleport-based movement and ever-changing labyrinths. Plan your path, avoid traps, and reach the exit using precise timing and smart decisions. Each level grows more complex, blending puzzle-solving with quick reactions. Think fast, blink smart, and find your way out.',
    controls: ['Tap to blink', 'Navigate the maze quickly'],
    buildType: 'iframe',
    sourceUrl: '/games/blink-maze/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 3.6, count: 55 },
    featured: false,
    genre: 'Puzzle',
    difficulty: 'Medium',
    estTime: '60s',
    pro: false
  },
  {
    name: 'Neon Polarity',
    slug: 'neon-polarity',
    thumbnail: '/img/neon-polarity/neon-polarity-thumbnail-2.png',
    shortPitch: 'Switch polarities, dodge hazards, and survive a fast-paced neon reflex challenge.',
    description:
      'Neon Polarity tests your timing and focus as you shift between energy states to pass through matching obstacles. One wrong move and the run ends, so stay sharp and react fast. With glowing visuals, escalating speed, and simple controls, every session becomes an intense rhythm of survival. How long can you stay in sync?',
    controls: ['W / A / S / D or Arrow Keys — Move', 'Space — Fire', 'Q — Pull (Attract objects & energy)', 'E — Push (Repel enemies & hazards)', 'R — Reload'],
    buildType: 'iframe',
    sourceUrl: '/games/neon-polarity/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.4, count: 1050 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s',
    pro: false
  },
  {
    name: 'Block Smash',
    slug: 'block-smash',
    thumbnail: '/img/block-smash/block-smash-thumbnail.jpg',
    shortPitch: 'A vibrant 9×9 grid puzzle game where smart block placement and color matches lead to endless high-score fun.',
    description:
      'Block Smash challenges your logic with drag-and-drop shapes, color-clearing bonuses, and strategic grid play. Match rows, columns, and zones to score while managing limited block options. Easy to learn yet deeply addictive, it’s perfect for quick sessions or long score-chasing runs. Train your brain, relax, and keep smashing your high score.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/block-smash/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'portrait' },
    leaderboard: true,
    rating: { value: 4.5, count: 1050 },
    featured: false,
    genre: 'Puzzle',
    difficulty: 'Medium',
    estTime: '60s',
    pro: false
  },
  {
    name: '2048',
    slug: '2048',
    thumbnail: '/img/2048/2048-thumbnail.png', // make one later
    shortPitch: 'Slide, merge, and strategize to reach 2048 in this addictive number puzzle challenge.',
    description: 'Combine matching tiles to grow your numbers and work your way toward the ultimate goal. Every move counts as the grid fills up, testing your logic and planning skills. Simple controls, endless replay value, and satisfying progression make it perfect for quick brain workouts anytime. Can you reach 2048 and beyond?',
    controls: ['Arrow keys / swipe'],
    buildType: 'iframe',
    sourceUrl: '/games/2048/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '4/5', minHeight: 640, orientation: 'portrait' },
    leaderboard: true,
    genre: 'Puzzle',
    difficulty: 'Easy',
    estTime: '3–10m',
    pro: false
  },
  {
    name: 'PAC-MAN',
    slug: 'pacman',
    thumbnail: '/img/pacman/pacman-thumbnail.png',
    shortPitch: 'Navigate mazes, dodge ghosts, and chomp pellets in the timeless arcade classic.',
    description: 'Guide the iconic yellow hero through neon mazes while avoiding relentless ghosts and collecting every pellet. Master patterns, grab power-ups, and turn the chase in your favor for big scores. Easy to pick up yet endlessly challenging, it’s a retro experience that still tests reflex and strategy.',
    controls: ['Arrow keys', 'Swipe on mobile'],
    buildType: 'iframe',
    sourceUrl: '/games/pacman/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    genre: 'Arcade',
    difficulty: 'Medium',
    estTime: '3–5 min',
    pro: false
  },
  {
    name: 'Snake',
    slug: 'snake',
    thumbnail: '/img/snake/snake-thumbnail.png',
    shortPitch: 'Guide the growing snake, collect food, and survive as the speed and challenge increase.',
    description: 'Control the snake as it moves across the screen, eating food to grow longer while avoiding walls and itself. Every move becomes more intense as space shrinks and speed rises. Simple controls, endless challenge, and pure reflex-based gameplay make it timeless fun. Popularized on early mobile phones by Nokia, Snake remains one of the most iconic arcade experiences.',
    controls: ['Arrow keys / WASD', 'Swipe on mobile'],
    buildType: 'iframe',
    sourceUrl: '/games/snake/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'any' },
    leaderboard: true,
    genre: 'Arcade',
    difficulty: 'Easy',
    estTime: '2–5m',
    pro: false
  },
  {
    name: 'Triangle Arena',
    slug: 'triangle-arena',
    thumbnail: '/img/triangle-arena/triangle-arena-thumbnail.jpeg',
    shortPitch: 'Dice-based strategy game—connect dots to complete triangles and outscore your opponent.',
    description: 'Roll the dice, draw that many lines between neighboring dots, and claim triangles the moment you close them. No crossing, no repeats—most triangles wins.',
    controls: ['Drag and Click to draw lines', 'Complete triangles to score points'],
    buildType: 'iframe',
    sourceUrl: '/games/triangle-arena/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'any' },
    leaderboard: true,
    genre: 'Arcade',
    difficulty: 'Easy',
    estTime: '2–5m',
    pro: false
  },
  {
    name: 'Qurbani Run',
    slug: 'qurbani-run',
    thumbnail: '/img/qurbani-run/qurbani-run-thumbnail.png',
    shortPitch: 'মিউজিকের তালে দ্রুত ডজ করে বসের আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকার রিদম-ভিত্তিক অ্যাকশন গেম।',
    description:
      'Qurbani Run হলো একটি দ্রুতগতির রিদম-ভিত্তিক অ্যাকশন গেম, যেখানে আপনাকে মিউজিকের তালে তালে একের পর এক शक्तिशाली बसेर मुखोमुखी हते होবे। नियन आलोर युद्धक्षेत्रे बसेर छोड़ा बुलेट ओ आक्रमण एड़िये यतक्षण सम्भव टिके थाकाइ आपनार मूल लक्ष्य। खेलार माझे Slow Mo, Shield ओ Magnet-এর मতो पাওয়ার-আপ संग्रह करे सामयिक सुविधা निते पारবेन। पाशापाशि यत कয়েन संग्रह करे निजेर स्कोर आरও बढ़िये निते हबे। लाइभ टुर्नामेन्ट चलाकालीन सर्वोच्च स्कोर करेइ लिडारबोर्डे उपरेर दिके उठे आसते हबे।',
    controls: [
      'মোবাইল/ট্যাব: স্ক্রিনের বাম বা ডান পাশে টাচ করে দ্রুত ডজ করুন।',
      'কিবোর্ড: Left Arrow / Right Arrow চেপে ডানে-বামে সরুন।',
      'বসের বুলেট ও আক্রমণ এড়িয়ে যতক্ষণ সম্ভব টিকে থাকুন।',
      'পাওয়ার-আপ সংগ্রহ করুন: Slow Mo, Shield, Magnet।',
      'যত বেশি সম্ভব কয়েন সংগ্রহ করুন।'
    ],
    buildType: 'iframe',
    sourceUrl: '/games/qurbani-run/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'portrait' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '৬০ সেকেন্ড',
    pro: false
  }
]
