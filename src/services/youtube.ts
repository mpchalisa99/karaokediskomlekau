import { Song, SuffixFilter, CategoryPreset } from '../types/karaoke';

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'hits-indonesia',
    label: 'Favorit Hits Indonesia',
    query: 'Lagu Karaoke Hit Indonesia Populer',
    description: 'Bernadya, Sal Priadi, Mahalini, Tulus, Judika, Dewa 19, Sheila on 7, Naff, Cakra Khan',
    iconName: 'Flame',
    badgeColor: 'from-rose-500 via-amber-500 to-red-600',
  },
  {
    id: 'semua-video-yt',
    label: '🌐 Semua Video Populer',
    query: 'Official Music Video Indonesia Populer',
    description: 'Akses bebas ke semua video YouTube (Official Music Video, Klip Asli, & Live Concert)',
    iconName: 'Globe',
    badgeColor: 'from-red-600 to-rose-700',
  },
  {
    id: 'mars-tni-au',
    label: '🎖️ Mars TNI AU & Nasional',
    query: 'Mars TNI AU Swa Bhuwana Paksa',
    description: 'Mars TNI AU, Swa Bhuwana Paksa, Hymne TNI AU, Indonesia Raya, Padamu Negeri',
    iconName: 'Shield',
    badgeColor: 'from-yellow-500 to-amber-600',
  },
  {
    id: 'naff-cakra',
    label: 'Naff & Cakra Khan',
    query: 'Naff Cakra Khan Karaoke Populer',
    description: 'Kenanglah Aku, Akhirnya Ku Menemukanmu, Kekasih Bayangan, Harus Terpisah',
    iconName: 'Mic',
    badgeColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'kerispatih-adaband',
    label: 'Kerispatih & Ada Band',
    query: 'Kerispatih Ada Band Karaoke Hits',
    description: 'Demi Cinta, Bila Rasaku Ini Rasamu, Manusia Bodoh, Karena Wanita',
    iconName: 'Music',
    badgeColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'java-jive-nostalgia',
    label: 'Java Jive & 90s Indo',
    query: 'Java Jive 90s Pop Indonesia Karaoke',
    description: 'Gerangan Cinta, Menikah, Kangen, Dan, Kenangan Terindah',
    iconName: 'Disc',
    badgeColor: 'from-sky-500 to-indigo-600',
  },
  {
    id: 'slow-rock',
    label: 'Slow Rock Ballads',
    query: 'Slow Rock Ballads',
    description: 'Scorpions, Bon Jovi, Guns N Roses, White Lion, Deep Purple',
    iconName: 'Radio',
    badgeColor: 'from-purple-500 to-pink-600',
  },
  {
    id: 'dangdut-koplo',
    label: 'Dangdut & Koplo',
    query: 'Dangdut Koplo Populer',
    description: 'Rhoma Irama, Denny Caknan, Via Vallen, Didi Kempot',
    iconName: 'Sparkles',
    badgeColor: 'from-yellow-400 to-amber-500',
  },
];

// Curated high quality karaoke video IDs for instant play & fallback
export const CURATED_LIBRARY: Record<string, Song[]> = {
  'hits-indonesia': [
    // === TRENDING & SERING DINYANYIKAN DI YOUTUBE INDONESIA ===
    {
      id: 'tAuZPYrbC1M',
      title: 'Bernadya – Satu Bulan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/tAuZPYrbC1M/hqdefault.jpg',
      duration: '3:37',
      isCurated: true,
    },
    {
      id: 'BD_fdy4PsNs',
      title: 'Sal Priadi - Gala Bunga Matahari (Karaoke)',
      channelTitle: 'WNF Production',
      thumbnailUrl: 'https://img.youtube.com/vi/BD_fdy4PsNs/hqdefault.jpg',
      duration: '4:12',
      isCurated: true,
    },
    {
      id: 'BzJsUqvKrRY',
      title: 'Mahalini - Sial (Karaoke Version)',
      channelTitle: 'Sing King',
      thumbnailUrl: 'https://img.youtube.com/vi/BzJsUqvKrRY/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 'JGtCTV0pHTw',
      title: 'Mahalini - Sisa Rasa (Karaoke Version)',
      channelTitle: 'KaraokeTransposisiID',
      thumbnailUrl: 'https://img.youtube.com/vi/JGtCTV0pHTw/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 's9PvvqOzVrg',
      title: 'Fabio Asher - Rumah Singgah (Karaoke Original Key)',
      channelTitle: 'Gracio Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/s9PvvqOzVrg/hqdefault.jpg',
      duration: '4:23',
      isCurated: true,
    },
    {
      id: 'FkTT-NllZg0',
      title: 'Keisya Levronka - Tak Ingin Usai (Karaoke Version)',
      channelTitle: 'Sing King',
      thumbnailUrl: 'https://img.youtube.com/vi/FkTT-NllZg0/hqdefault.jpg',
      duration: '4:51',
      isCurated: true,
    },
    {
      id: 'MmNNTAiYSPI',
      title: 'Tiara Andini - Usai (Karaoke Version)',
      channelTitle: 'Karaoke Music',
      thumbnailUrl: 'https://img.youtube.com/vi/MmNNTAiYSPI/hqdefault.jpg',
      duration: '3:35',
      isCurated: true,
    },
    {
      id: 'wmGPQyzn43g',
      title: 'Lyodra - Pesan Terakhir (Karaoke)',
      channelTitle: 'Gitaris Laperan',
      thumbnailUrl: 'https://img.youtube.com/vi/wmGPQyzn43g/hqdefault.jpg',
      duration: '4:17',
      isCurated: true,
    },
    {
      id: '-Ni9jyfrbQ0',
      title: 'Tulus – Hati-Hati di Jalan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/-Ni9jyfrbQ0/hqdefault.jpg',
      duration: '4:18',
      isCurated: true,
    },
    {
      id: 'CTnsWbt1lGk',
      title: 'Judika - Putus Atau Terus (Karaoke)',
      channelTitle: 'GMusic Entertainment',
      thumbnailUrl: 'https://img.youtube.com/vi/CTnsWbt1lGk/hqdefault.jpg',
      duration: '4:24',
      isCurated: true,
    },
    {
      id: 'AskQIq_bBe8',
      title: 'Rizky Febian - Hingga Tua Bersama (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AskQIq_bBe8/hqdefault.jpg',
      duration: '4:25',
      isCurated: true,
    },
    {
      id: 'SgViblwSxJo',
      title: 'Budi Doremi – Melukis Senja (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/SgViblwSxJo/hqdefault.jpg',
      duration: '4:23',
      isCurated: true,
    },
    {
      id: 'F6c9qzBVsoA',
      title: 'Juicy Luicy - Lantas (Official Karaoke Video)',
      channelTitle: 'E-Motion Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/F6c9qzBVsoA/hqdefault.jpg',
      duration: '3:57',
      isCurated: true,
    },
    {
      id: 'z6RprPOnY-4',
      title: 'Hindia - Evaluasi (Karaoke Version)',
      channelTitle: 'Karaoke Music',
      thumbnailUrl: 'https://img.youtube.com/vi/z6RprPOnY-4/hqdefault.jpg',
      duration: '3:20',
      isCurated: true,
    },
    {
      id: '3FtDDG054mQ',
      title: 'Guyon Waton x Denny Caknan - Sanes (Karaoke Lirik)',
      channelTitle: 'Regis Production',
      thumbnailUrl: 'https://img.youtube.com/vi/3FtDDG054mQ/hqdefault.jpg',
      duration: '5:12',
      isCurated: true,
    },
    {
      id: 'dlSgNpqrwUk',
      title: 'Denny Caknan - Cundamani (Karaoke HQ)',
      channelTitle: 'Rosmeiga Music Official',
      thumbnailUrl: 'https://img.youtube.com/vi/dlSgNpqrwUk/hqdefault.jpg',
      duration: '5:02',
      isCurated: true,
    },
    {
      id: 'auzlkVQDaLo',
      title: 'Virgoun - Surat Cinta Untuk Starla (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/auzlkVQDaLo/hqdefault.jpg',
      duration: '4:37',
      isCurated: true,
    },
    {
      id: '2RdxMXzPGP8',
      title: 'Andmesh Kamaleng - Cinta Luar Biasa (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/2RdxMXzPGP8/hqdefault.jpg',
      duration: '4:29',
      isCurated: true,
    },
    {
      id: 'DDZ4fAJ-bms',
      title: 'Payung Teduh - Akad (Karaoke)',
      channelTitle: 'GMusic Entertainment',
      thumbnailUrl: 'https://img.youtube.com/vi/DDZ4fAJ-bms/hqdefault.jpg',
      duration: '4:32',
      isCurated: true,
    },
    {
      id: 'OWSFePIWebg',
      title: 'Anji - Dia (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/OWSFePIWebg/hqdefault.jpg',
      duration: '3:41',
      isCurated: true,
    },
    {
      id: 'jR6Gc1Jz0BY',
      title: 'Glenn Fredly - Januari (Karaoke Version)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/jR6Gc1Jz0BY/hqdefault.jpg',
      duration: '3:50',
      isCurated: true,
    },
    {
      id: '8ndnUh7uQoI',
      title: 'Chrisye - Kisah Kasih Di Sekolah (Official Karaoke)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/8ndnUh7uQoI/hqdefault.jpg',
      duration: '4:34',
      isCurated: true,
    },
    {
      id: 'alRNA5MGXog',
      title: 'Kangen Band – Terbang Bersamaku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/alRNA5MGXog/hqdefault.jpg',
      duration: '3:55',
      isCurated: true,
    },
    {
      id: 'Mkgd1sVxjr4',
      title: 'Armada - Harusnya Aku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Mkgd1sVxjr4/hqdefault.jpg',
      duration: '5:00',
      isCurated: true,
    },
    {
      id: 'm-ddbbls3do',
      title: 'Dewa 19 – Risalah Hati (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/m-ddbbls3do/hqdefault.jpg',
      duration: '5:11',
      isCurated: true,
    },
    {
      id: 'ms4KdUZtY7g',
      title: 'Dewa 19 - Pupus (Karaoke Version)',
      channelTitle: 'TirtaMedia',
      thumbnailUrl: 'https://img.youtube.com/vi/ms4KdUZtY7g/hqdefault.jpg',
      duration: '5:08',
      isCurated: true,
    },
    {
      id: 'Y2k4Ex5aWs4',
      title: 'Dewa 19 - Kangen (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Y2k4Ex5aWs4/hqdefault.jpg',
      duration: '5:23',
      isCurated: true,
    },
    {
      id: 'F4kPLr5ngLo',
      title: 'Sheila On 7 - Dan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/F4kPLr5ngLo/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: 'bYwkHbnycJ0',
      title: 'Sheila On 7 - Sephia (Karaoke Version)',
      channelTitle: 'Sing King',
      thumbnailUrl: 'https://img.youtube.com/vi/bYwkHbnycJ0/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    // === POP & NOSTALGIA HITS INDONESIA ===
    {
      id: 'BnlzOzdP8Is',
      title: 'Naff - Kenanglah Aku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/BnlzOzdP8Is/hqdefault.jpg',
      duration: '4:10',
      isCurated: true,
    },
    {
      id: 'AHZlSVQc7FE',
      title: 'Naff - Akhirnya Ku Menemukanmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AHZlSVQc7FE/hqdefault.jpg',
      duration: '4:49',
      isCurated: true,
    },
    {
      id: 'yyBA_2Gv3RA',
      title: 'Cakra Khan - Kekasih Bayangan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/yyBA_2Gv3RA/hqdefault.jpg',
      duration: '4:53',
      isCurated: true,
    },
    {
      id: 'lyttQsPjhEo',
      title: 'Cakra Khan - Harus Terpisah (Karaoke Version)',
      channelTitle: 'Karaoke Piano',
      thumbnailUrl: 'https://img.youtube.com/vi/lyttQsPjhEo/hqdefault.jpg',
      duration: '3:59',
      isCurated: true,
    },
    {
      id: '7smwlWzip0k',
      title: 'Kerispatih - Demi Cinta (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/7smwlWzip0k/hqdefault.jpg',
      duration: '5:02',
      isCurated: true,
    },
    {
      id: 'AwP1nVaFaNA',
      title: 'Kerispatih - Bila Rasaku Ini Rasamu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AwP1nVaFaNA/hqdefault.jpg',
      duration: '4:51',
      isCurated: true,
    },
    {
      id: 'y4tuQ2kXwT8',
      title: 'Kerispatih - Lagu Rindu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/y4tuQ2kXwT8/hqdefault.jpg',
      duration: '4:48',
      isCurated: true,
    },
    {
      id: 'bP_idWQ60bc',
      title: 'Java Jive - Gerangan Cinta (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/bP_idWQ60bc/hqdefault.jpg',
      duration: '5:31',
      isCurated: true,
    },
    {
      id: 'WHyRvFKJ4rg',
      title: 'Java Jive - Menikah (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/WHyRvFKJ4rg/hqdefault.jpg',
      duration: '4:04',
      isCurated: true,
    },
    {
      id: 'tljYFLQupq8',
      title: 'Ada Band - Manusia Bodoh (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/tljYFLQupq8/hqdefault.jpg',
      duration: '4:33',
      isCurated: true,
    },
    {
      id: 'vQtrfTSy0GY',
      title: 'Ada Band - Karena Wanita (Ingin Dimengerti) (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/vQtrfTSy0GY/hqdefault.jpg',
      duration: '4:50',
      isCurated: true,
    },
    {
      id: '3MWDBse8qPU',
      title: 'Ada Band - Haruskah Ku Mati (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/3MWDBse8qPU/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: '8L7fRR2NwU0',
      title: 'Ada Band - Masih (Sahabatku Kekasihku) (Karaoke Version)',
      channelTitle: 'Tangga Music Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/8L7fRR2NwU0/hqdefault.jpg',
      duration: '5:14',
      isCurated: true,
    },
    {
      id: 'ACgWSbWgU-U',
      title: 'Samsons - Kenangan Terindah (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/ACgWSbWgU-U/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 'Boc2E7RSGnc',
      title: 'Ungu - Demi Waktu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Boc2E7RSGnc/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    {
      id: 'IUfZaqPqVPg',
      title: 'Peterpan - Menghapus Jejakmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/IUfZaqPqVPg/hqdefault.jpg',
      duration: '3:23',
      isCurated: true,
    },
  ],
  'naff-cakra': [
    {
      id: 'BnlzOzdP8Is',
      title: 'Naff - Kenanglah Aku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/BnlzOzdP8Is/hqdefault.jpg',
      duration: '4:10',
      isCurated: true,
    },
    {
      id: 'AHZlSVQc7FE',
      title: 'Naff - Akhirnya Ku Menemukanmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AHZlSVQc7FE/hqdefault.jpg',
      duration: '4:49',
      isCurated: true,
    },
    {
      id: 'otoJG0QdxIA',
      title: 'Naff - Terendap Laraku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/otoJG0QdxIA/hqdefault.jpg',
      duration: '5:24',
      isCurated: true,
    },
    {
      id: 'yyBA_2Gv3RA',
      title: 'Cakra Khan - Kekasih Bayangan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/yyBA_2Gv3RA/hqdefault.jpg',
      duration: '4:53',
      isCurated: true,
    },
    {
      id: 'lyttQsPjhEo',
      title: 'Cakra Khan - Harus Terpisah (Karaoke Version)',
      channelTitle: 'Karaoke Piano',
      thumbnailUrl: 'https://img.youtube.com/vi/lyttQsPjhEo/hqdefault.jpg',
      duration: '3:59',
      isCurated: true,
    },
  ],
  'kerispatih-adaband': [
    {
      id: '7smwlWzip0k',
      title: 'Kerispatih - Demi Cinta (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/7smwlWzip0k/hqdefault.jpg',
      duration: '5:02',
      isCurated: true,
    },
    {
      id: 'AwP1nVaFaNA',
      title: 'Kerispatih - Bila Rasaku Ini Rasamu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AwP1nVaFaNA/hqdefault.jpg',
      duration: '4:51',
      isCurated: true,
    },
    {
      id: 'y4tuQ2kXwT8',
      title: 'Kerispatih - Lagu Rindu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/y4tuQ2kXwT8/hqdefault.jpg',
      duration: '4:48',
      isCurated: true,
    },
    {
      id: 'R8KkGn2ULD8',
      title: 'Kerispatih - Aku Harus Jujur (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/R8KkGn2ULD8/hqdefault.jpg',
      duration: '4:42',
      isCurated: true,
    },
    {
      id: 'qipJJo7ea_c',
      title: 'Kerispatih - Kejujuran Hati (Karaoke Tanpa Vokal)',
      channelTitle: 'Danker Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/qipJJo7ea_c/hqdefault.jpg',
      duration: '6:20',
      isCurated: true,
    },
    {
      id: 'tljYFLQupq8',
      title: 'Ada Band - Manusia Bodoh (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/tljYFLQupq8/hqdefault.jpg',
      duration: '4:33',
      isCurated: true,
    },
    {
      id: 'vQtrfTSy0GY',
      title: 'Ada Band - Karena Wanita (Ingin Dimengerti) (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/vQtrfTSy0GY/hqdefault.jpg',
      duration: '4:50',
      isCurated: true,
    },
    {
      id: '3MWDBse8qPU',
      title: 'Ada Band - Haruskah Ku Mati (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/3MWDBse8qPU/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: '8L7fRR2NwU0',
      title: 'Ada Band - Masih (Sahabatku Kekasihku) (Karaoke Version)',
      channelTitle: 'Tangga Music Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/8L7fRR2NwU0/hqdefault.jpg',
      duration: '5:14',
      isCurated: true,
    },
  ],
  'java-jive-nostalgia': [
    {
      id: 'bP_idWQ60bc',
      title: 'Java Jive - Gerangan Cinta (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/bP_idWQ60bc/hqdefault.jpg',
      duration: '5:31',
      isCurated: true,
    },
    {
      id: 'WHyRvFKJ4rg',
      title: 'Java Jive - Menikah (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/WHyRvFKJ4rg/hqdefault.jpg',
      duration: '4:04',
      isCurated: true,
    },
    {
      id: 'Y2k4Ex5aWs4',
      title: 'Dewa 19 - Kangen (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Y2k4Ex5aWs4/hqdefault.jpg',
      duration: '5:23',
      isCurated: true,
    },
    {
      id: 'F4kPLr5ngLo',
      title: 'Sheila On 7 - Dan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/F4kPLr5ngLo/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: 'ACgWSbWgU-U',
      title: 'Samsons - Kenangan Terindah (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/ACgWSbWgU-U/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 'Boc2E7RSGnc',
      title: 'Ungu - Demi Waktu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Boc2E7RSGnc/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    {
      id: 'TTy8adFm0aQ',
      title: 'Padi - Menanti Sebuah Jawaban (Karaoke HQ Audio)',
      channelTitle: 'Replay Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/TTy8adFm0aQ/hqdefault.jpg',
      duration: '4:35',
      isCurated: true,
    },
  ],
  'slow-rock': [
    {
      id: 'LtddOnEqNTo',
      title: 'Scorpions - Wind Of Change (Karaoke Version)',
      channelTitle: 'KaraokeyTV',
      thumbnailUrl: 'https://img.youtube.com/vi/LtddOnEqNTo/hqdefault.jpg',
      duration: '4:43',
      isCurated: true,
    },
    {
      id: '9F0mAiipcwM',
      title: 'Bon Jovi - Bed Of Roses (HD Karaoke)',
      channelTitle: 'Atomic Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/9F0mAiipcwM/hqdefault.jpg',
      duration: '6:46',
      isCurated: true,
    },
    {
      id: 'KFUW0p50P58',
      title: 'Guns N Roses - November Rain (Karaoke With Lyrics)',
      channelTitle: 'Musisi Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/KFUW0p50P58/hqdefault.jpg',
      duration: '9:03',
      isCurated: true,
    },
    {
      id: 'OA47LSSlfhk',
      title: 'White Lion - When The Children Cry (HQ Karaoke)',
      channelTitle: 'Otep333 Karaoke Trackz',
      thumbnailUrl: 'https://img.youtube.com/vi/OA47LSSlfhk/hqdefault.jpg',
      duration: '4:24',
      isCurated: true,
    },
  ],
  'dangdut-koplo': [
    {
      id: 'YzM4GDKZaM4',
      title: 'Denny Caknan - Kartonyono Medot Janji (Karaoke)',
      channelTitle: 'GMusic Entertainment',
      thumbnailUrl: 'https://img.youtube.com/vi/YzM4GDKZaM4/hqdefault.jpg',
      duration: '4:40',
      isCurated: true,
    },
    {
      id: 'rMJyjdQcUFc',
      title: 'Didi Kempot - Pamer Bojo (Karaoke Audio HQ)',
      channelTitle: 'Rosmeiga Music Official',
      thumbnailUrl: 'https://img.youtube.com/vi/rMJyjdQcUFc/hqdefault.jpg',
      duration: '5:37',
      isCurated: true,
    },
    {
      id: '81wbexmUVls',
      title: 'Via Vallen - Sayang KOPLO (Karaoke)',
      channelTitle: 'GMusic Entertainment',
      thumbnailUrl: 'https://img.youtube.com/vi/81wbexmUVls/hqdefault.jpg',
      duration: '4:35',
      isCurated: true,
    },
    {
      id: 'YxNCrxWzqys',
      title: 'Denny Caknan - Los Dol (Karaoke)',
      channelTitle: 'GMusic Entertainment',
      thumbnailUrl: 'https://img.youtube.com/vi/YxNCrxWzqys/hqdefault.jpg',
      duration: '4:15',
      isCurated: true,
    },
    {
      id: 'DaojjdnPEN0',
      title: 'Rhoma Irama - Begadang (Karaoke Nada Pria)',
      channelTitle: 'Karaoke Nada Pria',
      thumbnailUrl: 'https://img.youtube.com/vi/DaojjdnPEN0/hqdefault.jpg',
      duration: '3:50',
      isCurated: true,
    },
    {
      id: '0rsErjsUYVk',
      title: 'Didi Kempot - Banyu Langit (Karaoke Koplo)',
      channelTitle: 'Rosmeiga Music Official',
      thumbnailUrl: 'https://img.youtube.com/vi/0rsErjsUYVk/hqdefault.jpg',
      duration: '5:00',
      isCurated: true,
    },
  ],
};

// Clean HTML entities returned by YouTube API (e.g., &#39; -> ')
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

// Extract Video ID if user pastes YouTube URL
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|m\.youtube\.com\/watch\?v=)([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Build the exact search query by automatically appending 'karaoke' or 'no vocal'
 */
export function buildKaraokeQuery(userInput: string, suffix: SuffixFilter): string {
  const cleanInput = userInput.trim();
  if (!cleanInput) return '';

  const lower = cleanInput.toLowerCase();
  if (suffix === 'karaoke') {
    if (!lower.includes('karaoke')) {
      return `${cleanInput} karaoke`;
    }
    return cleanInput;
  }
  if (suffix === 'no vocal') {
    if (!lower.includes('no vocal') && !lower.includes('tanpa vokal')) {
      return `${cleanInput} no vocal`;
    }
    return cleanInput;
  }
  if (suffix === 'instrumental') {
    if (!lower.includes('instrumental')) {
      return `${cleanInput} instrumental`;
    }
    return cleanInput;
  }
  return cleanInput;
}

/**
 * Fetch video details via public YouTube oEmbed (Zero API Key required)
 */
export async function fetchOEmbedInfo(videoId: string): Promise<{ title?: string; author_name?: string } | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    );
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title,
        author_name: data.author_name,
      };
    }
  } catch (e) {
    // fallback
  }
  return null;
}

/**
 * Public Invidious mirror search fallback (No API key needed)
 */
async function searchViaInvidious(query: string): Promise<Song[]> {
  const mirrors = [
    'https://inv.nadeko.net/api/v1/search',
    'https://invidious.nerdvpn.de/api/v1/search',
  ];

  for (const mirror of mirrors) {
    try {
      const res = await fetch(`${mirror}?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          return items.slice(0, 16).map((item: any) => ({
            id: item.videoId,
            title: decodeHtmlEntities(item.title || ''),
            channelTitle: item.author || 'YouTube Karaoke',
            thumbnailUrl:
              item.videoThumbnails?.[0]?.url ||
              `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
            duration: typeof item.lengthSeconds === 'number'
              ? `${Math.floor(item.lengthSeconds / 60)}:${String(item.lengthSeconds % 60).padStart(2, '0')}`
              : '',
            isCurated: false,
          }));
        }
      }
    } catch (e) {
      // try next mirror
    }
  }
  return [];
}

/**
 * Primary YouTube search function with server-side proxy
 */
export async function searchYouTube(
  query: string,
  suffix: SuffixFilter = 'karaoke'
): Promise<Song[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return CURATED_LIBRARY['hits-indonesia'] || [];
  }

  // 1. Direct link detection
  const extractedId = extractYoutubeVideoId(trimmed);
  if (extractedId) {
    const info = await fetchOEmbedInfo(extractedId);
    return [
      {
        id: extractedId,
        title: info?.title || `YouTube Video (${extractedId})`,
        channelTitle: info?.author_name || 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${extractedId}/hqdefault.jpg`,
        duration: 'YouTube',
        isCurated: false,
      },
    ];
  }

  const finalQuery = buildKaraokeQuery(trimmed, suffix);

  // 2. Server proxy search route with 10-second AbortController timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
        return data.songs.map((v: any) => ({
          id: v.id,
          title: decodeHtmlEntities(v.title || ''),
          channelTitle: v.channelTitle || 'YouTube',
          thumbnailUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
          duration: v.duration || '',
          publishedAt: v.publishedAt,
          isCurated: false,
        }));
      }
    }
  } catch (err) {
    console.warn('Backend proxy search timeout or network error, trying Invidious fallback:', err);
  }

  // 3. Invidious mirror fallback
  try {
    const invidiousResults = await searchViaInvidious(finalQuery);
    if (invidiousResults.length > 0) {
      return invidiousResults;
    }
  } catch (e) {
    // continue to fallback
  }

  // 4. Return curated library matching keywords or hits-indonesia
  const lowerQ = trimmed.toLowerCase();
  for (const [catKey, songs] of Object.entries(CURATED_LIBRARY)) {
    if (songs.some((s) => s.title.toLowerCase().includes(lowerQ))) {
      return songs;
    }
  }

  return CURATED_LIBRARY['hits-indonesia'] || [];
}

export interface SearchResultWrapper {
  songs: Song[];
  isCuratedFallback: boolean;
  error?: string;
}

export async function searchKaraokeSongs(
  query: string,
  suffix: SuffixFilter = 'karaoke',
  categoryId?: string
): Promise<SearchResultWrapper> {
  const trimmed = (query || '').trim();

  // If specific category selected with matching curated songs
  if (categoryId && (!trimmed || categoryId === 'hits-indonesia' || categoryId === 'naff-cakra' || categoryId === 'kerispatih-adaband' || categoryId === 'java-jive-nostalgia')) {
    const curated = CURATED_LIBRARY[categoryId];
    if (curated && curated.length > 0) {
      return {
        songs: curated,
        isCuratedFallback: true,
      };
    }
  }

  if (!trimmed) {
    const defaultSongs = (categoryId && CURATED_LIBRARY[categoryId]) || CURATED_LIBRARY['hits-indonesia'] || [];
    return {
      songs: defaultSongs,
      isCuratedFallback: true,
    };
  }

  try {
    const songs = await searchYouTube(trimmed, suffix);
    if (songs && songs.length > 0) {
      return {
        songs,
        isCuratedFallback: songs[0]?.isCurated ?? false,
      };
    }
  } catch (err: any) {
    return {
      songs: CURATED_LIBRARY['hits-indonesia'] || [],
      isCuratedFallback: true,
      error: 'Pencarian online dialihkan ke koleksi lagu favorit.',
    };
  }

  return {
    songs: CURATED_LIBRARY['hits-indonesia'] || [],
    isCuratedFallback: true,
  };
}
