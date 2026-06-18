/**
 * Welkomstkaart (eerste login) + hulpgids, per taal. De vaste chrome-teksten
 * staan in i18n.ts (zelfde Lang-sleutel).
 *
 * i18n: voeg een taal toe door het `GuideContent`-object te vertalen en aan
 * `guides` toe te voegen. ZH en ID zijn een eerste versie — laat nakijken.
 */

import type { Lang } from './i18n';

export interface GuideItem {
  /** Vetgedrukt kopje vóór de tekst, bv. "Tree". */
  label?: string;
  text: string;
}

/** Een rijk sub-onderdeel binnen een sectie, met een eigen kopje. */
export interface GuideBlock {
  /** Subkopje. */
  h?: string;
  p?: string[];
  items?: GuideItem[];
  note?: string;
}

export interface GuideSection {
  /** Titel in de samenvouwbare kop. */
  q: string;
  /** Alinea's. */
  p?: string[];
  /** Opsomming. */
  items?: GuideItem[];
  /** Terzijde, met accentrand (bv. een voorbeeld of een let-op). */
  note?: string;
  /** Meerdelige inhoud met subkopjes (bv. privacy). */
  blocks?: GuideBlock[];
}

export interface GuideContent {
  welcome: {
    title: string;
    intro: string;
    leadIn: string;
    steps: { title: string; body: string }[];
    start: string;
    more: string;
  };
  guide: {
    title: string;
    intro: string;
    sections: GuideSection[];
  };
}

const nl: GuideContent = {
  welcome: {
    title: 'Welkom bij Bloom 🌱',
    intro: 'Bloom tekent je familie als een levend web rond één persoon — meestal jij.',
    leadIn: 'In drie stappen sta je erin:',
    steps: [
      {
        title: 'Dit ben ik',
        body: 'Vind jezelf in de boom of maak je eigen persoon aan. Vanaf daar worden alle relaties benoemd: "oma", "neef", "partner".',
      },
      { title: 'Voeg familie toe', body: 'Klik op jezelf en voeg een ouder, partner of kind toe. Zo groeit de boom vanzelf.' },
      { title: 'Nodig anderen uit', body: 'Laat familie meebouwen — ieder vult aan wat hij weet.' },
    ],
    start: 'Aan de slag',
    more: 'Meer uitleg',
  },
  guide: {
    title: 'Hoe werkt Bloom?',
    intro:
      'Bloom is een familieboom die meedenkt vanuit perspectief: je ziet je familie als een web rond één persoon, met de relaties benoemd zoals jíj ze kent.',
    sections: [
      {
        q: 'De twee weergaven',
        p: ['Wissel rechtsboven tussen de twee manieren om je familie te bekijken.'],
        items: [
          { label: 'Boom', text: 'de werkweergave. Hier navigeer je, bewerk je personen en bekijk je foto’s. Klik op iemand om in te zoomen.' },
          { label: 'Tableau', text: 'een rustig, artistiek overzicht van de hele familie. Mooi om naar te kijken of te delen, niet om in te werken.' },
        ],
      },
      {
        q: 'Privacy & zichtbaarheid',
        p: ['Een familieboom is privé. Jij beslist wie wat ziet — per persoon én per relatie.'],
        blocks: [
          {
            h: 'Besloten, op uitnodiging',
            p: ['Niemand kan je boom vinden of openen zonder uitnodiging. Een uitgelogde bezoeker ziet alleen de demo. Je deelt via een link; wie zich aanmeldt staat eerst in afwachting en wordt pas lid als de beheerder goedkeurt.'],
          },
          {
            h: 'Drie niveaus van zichtbaarheid',
            p: ['Elke persoon — en elke relatie — heeft een zichtbaarheid:'],
            items: [
              { label: 'Openbaar', text: 'voor iedereen, ook zonder login (voor wat je bewust deelt).' },
              { label: 'Familie', text: 'voor alle leden van deze boom (standaard).' },
              { label: 'Privé', text: 'alleen voor de beheerder.' },
            ],
            note: 'Geldt er meer dan één instelling, dan wint de strengste. Voorbeeld: je oma wil haar geboortejaar niet met de hele familie delen → zet haar op privé; alleen de beheerder ziet haar dan.',
          },
          { h: 'Je gaat over jezelf', p: ['Je mag je eigen gegevens altijd strenger zetten dan een beheerder deed — ook al beheert iemand anders jouw knooppunt.'] },
          { h: 'Verborgen, maar de boom blijft kloppen', p: ['Een afgeschermde persoon verdwijnt niet helemaal: anderen zien "verborgen persoon" op die plek, zodat verbindingen — en wie familie van wie is — blijven kloppen binnen je eigen boom.'] },
          {
            h: 'Gedeelde feiten',
            p: ['Een huwelijk of ouder–kindband is van twee mensen samen — een gedeeld feit. Zo’n band blijft standaard zichtbaar voor de familie, zodat de stamboom klopt en je kunt zien wie familie van wie is.'],
            note: 'Het apart, fijnmazig afschermen van losse relaties — en een band alleen met instemming van beide kanten verbergen — is ontworpen maar zit nog niet in deze versie.',
          },
          { h: 'Wat "verborgen" wél en niet betekent', p: ['Verbergen beschermt tegen toevallig meekijken en tegen buitenstaanders. Het is géén garantie tegen een familielid dat goed nadenkt: uit wie wél zichtbaar is, valt soms af te leiden wie verborgen is (een zichtbare halfbroer verraadt een gedeelde ouder). Voor een écht geheim kun je iemand beter helemaal niet invoeren.'] },
        ],
      },
      {
        q: '"Dit ben ik" en perspectief',
        p: ['Relaties krijgen pas betekenis vanuit iemand: "moeder van Anna", "neef van Tom". Daarom kies je een ik.'],
        items: [
          { label: 'Dit ben ik', text: 'koppelt je account aan een persoon — dat wordt je vaste vertrekpunt.' },
          { label: 'Bekijk vanuit …', text: 'laat je tijdelijk door andermans ogen kijken. Met "terug naar standaard" sta je weer bij jezelf.' },
        ],
      },
      {
        q: 'Personen en relaties toevoegen',
        p: [
          'Klik op een persoon en kies + ouder, + partner of + kind. Je maakt een nieuw persoon aan, of koppelt iemand die al in de familie staat.',
          'In Gegevens vul je naam, jaren en een foto in. Onder "meer details" zitten bijnaam, naam in eigen schrift en zichtbaarheid.',
        ],
      },
      {
        q: 'Samen bouwen',
        p: ['Een familieboom wordt mooier met meer mensen. Nodig familie uit via Delen.'],
        items: [
          { label: 'Beheerder', text: 'mag alles, inclusief uitnodigen en koppelen.' },
          { label: 'Bewerker', text: 'mag personen en relaties aanvullen.' },
          { label: 'Lezer', text: 'bekijkt alleen.' },
        ],
      },
      {
        q: 'Foto’s',
        p: [
          'Zet het foto-icoon bovenin aan om profielfoto’s in de boom te tonen.',
          'Een foto voeg je toe bij een persoon onder Gegevens — uploaden of meteen met de camera.',
        ],
      },
      {
        q: 'Families koppelen (bruggen)',
        p: [
          'Komt dezelfde persoon in twee families voor — bijvoorbeeld door een huwelijk? Dan leg je een brug: de twee bomen blijven apart, maar je kunt van de één naar de ander oversteken.',
          'Beide beheerders moeten het doen: de één maakt een koppelcode, de ander plakt ’m.',
        ],
        note: 'Gevorderd — niet nodig om te beginnen.',
      },
    ],
  },
};

const en: GuideContent = {
  welcome: {
    title: 'Welcome to Bloom 🌱',
    intro: 'Bloom draws your family as a living web around one person — usually you.',
    leadIn: 'Three steps to get started:',
    steps: [
      { title: 'This is me', body: 'Find yourself in the tree or create your own person. From there, every relationship is named: "grandma", "cousin", "partner".' },
      { title: 'Add family', body: 'Click on yourself and add a parent, partner or child. The tree grows from there.' },
      { title: 'Invite others', body: 'Let family help build it — everyone adds what they know.' },
    ],
    start: 'Get started',
    more: 'Learn more',
  },
  guide: {
    title: 'How does Bloom work?',
    intro:
      'Bloom is a family tree that thinks in perspective: you see your family as a web around one person, with relationships named the way you know them.',
    sections: [
      {
        q: 'The two views',
        p: ['Switch top right between the two ways to view your family.'],
        items: [
          { label: 'Tree', text: 'the working view. Here you navigate, edit people and see photos. Click someone to zoom in.' },
          { label: 'Tableau', text: 'a calm, artistic overview of the whole family. Nice to look at or share, not to work in.' },
        ],
      },
      {
        q: 'Privacy & visibility',
        p: ['A family tree is private. You decide who sees what — per person and per relationship.'],
        blocks: [
          {
            h: 'Closed, by invitation',
            p: ['No one can find or open your tree without an invitation. A logged-out visitor only sees the demo. You share via a link; anyone who signs up is pending first and only becomes a member once the admin approves.'],
          },
          {
            h: 'Three levels of visibility',
            p: ['Every person — and every relationship — has a visibility:'],
            items: [
              { label: 'Public', text: 'for everyone, even without login (for what you choose to share).' },
              { label: 'Family', text: 'for all members of this tree (the default).' },
              { label: 'Private', text: 'for the admin only.' },
            ],
            note: 'If more than one setting applies, the strictest wins. Example: your grandma doesn’t want her birth year shared with the whole family → set her to private; only the admin sees her then.',
          },
          { h: 'You’re in charge of yourself', p: ['You may always set your own details stricter than an admin did — even if someone else manages your node.'] },
          { h: 'Hidden, but the tree still holds', p: ['A shielded person doesn’t vanish entirely: others see "hidden person" in that spot, so connections — and who is related to whom — stay correct within your own tree.'] },
          {
            h: 'Shared facts',
            p: ['A marriage or parent–child bond belongs to two people together — a shared fact. Such a bond stays visible to the family by default, so the tree holds and you can see who is related to whom.'],
            note: 'Shielding individual relationships finely — and hiding a bond only with both sides’ consent — is designed but not yet in this version.',
          },
          { h: 'What "hidden" does and doesn’t mean', p: ['Hiding protects against casual onlookers and outsiders. It’s no guarantee against a family member who thinks it through: from who is visible, one can sometimes deduce who is hidden (a visible half-brother reveals a shared parent). For a real secret, better not to enter someone at all.'] },
        ],
      },
      {
        q: '"This is me" and perspective',
        p: ['Relationships only gain meaning from someone: "Anna’s mother", "Tom’s cousin". That’s why you pick a "me".'],
        items: [
          { label: 'This is me', text: 'links your account to a person — that becomes your fixed starting point.' },
          { label: 'View from …', text: 'lets you temporarily look through someone else’s eyes. "Back to default" returns you to yourself.' },
        ],
      },
      {
        q: 'Adding people and relationships',
        p: [
          'Click a person and choose + parent, + partner or + child. You create a new person, or link someone already in the family.',
          'In Details you fill in name, years and a photo. Under "more details" are nickname, name in native script and visibility.',
        ],
      },
      {
        q: 'Building together',
        p: ['A family tree gets richer with more people. Invite family via Share.'],
        items: [
          { label: 'Admin', text: 'can do everything, including inviting and linking.' },
          { label: 'Editor', text: 'can add people and relationships.' },
          { label: 'Reader', text: 'views only.' },
        ],
      },
      {
        q: 'Photos',
        p: [
          'Turn on the photo icon at the top to show profile photos in the tree.',
          'You add a photo to a person under Details — upload or straight from the camera.',
        ],
      },
      {
        q: 'Linking families (bridges)',
        p: [
          'Does the same person appear in two families — through a marriage, say? Then you build a bridge: the two trees stay separate, but you can cross from one to the other.',
          'Both admins must do it: one creates a link code, the other pastes it.',
        ],
        note: 'Advanced — not needed to get started.',
      },
    ],
  },
};

const zh: GuideContent = {
  welcome: {
    title: '欢迎使用 Bloom 🌱',
    intro: 'Bloom 把您的家庭描绘成围绕一个人（通常是您）的生动网络。',
    leadIn: '三步即可加入：',
    steps: [
      { title: '这是我', body: '在树中找到自己或创建自己的人物。从此处开始，所有关系都会被命名："奶奶""表弟""伴侣"。' },
      { title: '添加家人', body: '点击自己，添加父母、伴侣或子女。家谱树会随之生长。' },
      { title: '邀请他人', body: '让家人一起构建 — 各自补充自己知道的部分。' },
    ],
    start: '开始',
    more: '了解更多',
  },
  guide: {
    title: 'Bloom 怎么用？',
    intro: 'Bloom 是一棵以视角思考的家谱树：您把家庭看作围绕一个人的网络，关系以您熟悉的方式命名。',
    sections: [
      {
        q: '两种视图',
        p: ['在右上角切换两种查看家庭的方式。'],
        items: [
          { label: '树状图', text: '工作视图。在此导航、编辑人物并查看照片。点击某人即可放大。' },
          { label: '画卷', text: '整个家庭的宁静、艺术化概览。适合观赏或分享，而非编辑。' },
        ],
      },
      {
        q: '隐私与可见性',
        p: ['家谱树是私密的。您决定谁能看到什么 — 可精确到每个人和每段关系。'],
        blocks: [
          {
            h: '封闭，需邀请',
            p: ['未经邀请，没有人能找到或打开您的树。未登录的访客只能看到演示。您通过链接分享；注册者先处于待批准状态，经管理员批准后才成为成员。'],
          },
          {
            h: '三种可见性级别',
            p: ['每个人 — 以及每段关系 — 都有可见性：'],
            items: [
              { label: '公开', text: '所有人可见，无需登录（用于您主动分享的内容）。' },
              { label: '家庭', text: '本树所有成员可见（默认）。' },
              { label: '私密', text: '仅管理员可见。' },
            ],
            note: '若有多项设置同时适用，以最严格者为准。例如：您奶奶不想把出生年份告诉全家 → 将她设为私密；这样只有管理员能看到她。',
          },
          { h: '您对自己有最终决定权', p: ['您始终可以把自己的资料设得比管理员更严格 — 即使您的节点由他人管理。'] },
          { h: '隐藏后家谱仍然成立', p: ['被隐藏的人不会完全消失：他人会在该位置看到"隐藏人物"，以便连接关系 — 以及谁与谁有亲属关系 — 在您自己的树中依然成立。'] },
          {
            h: '共享事实',
            p: ['婚姻或亲子关系属于两个人共同所有 — 这是一个共享事实。此类关系默认对家庭可见，以便家谱成立，您也能看清谁与谁有亲属关系。'],
            note: '对单个关系进行精细隐藏 — 以及仅在双方同意时才隐藏某段关系 — 已在设计中，但此版本尚未提供。',
          },
          { h: '"隐藏"意味着什么、不意味着什么', p: ['隐藏可防止无意的旁观和外人窥探。但它无法防范一个用心推敲的家庭成员：从可见者身上，有时能推断出谁被隐藏（一个可见的同父异母兄弟会暴露共同的父母）。若是真正的秘密，最好根本不要录入此人。'] },
        ],
      },
      {
        q: '"这是我"与视角',
        p: ['关系只有从某个人出发才有意义："Anna 的母亲""Tom 的表弟"。因此您要选定一个"我"。'],
        items: [
          { label: '这是我', text: '将您的账号关联到某个人 — 这将成为您固定的出发点。' },
          { label: '从…的视角', text: '让您暂时以他人的眼光来看。点击"恢复默认"即可回到自己。' },
        ],
      },
      {
        q: '添加人物与关系',
        p: [
          '点击一个人，选择 +父母、+伴侣或+子女。您可以新建一个人物，或关联家庭中已有的人。',
          '在"资料"中填写姓名、年份和照片。在"更多信息"下有昵称、母语文字姓名和可见性。',
        ],
      },
      {
        q: '共同构建',
        p: ['人越多，家谱树越丰富。通过"分享"邀请家人。'],
        items: [
          { label: '管理员', text: '可执行一切操作，包括邀请和连接。' },
          { label: '编辑者', text: '可添加人物和关系。' },
          { label: '读者', text: '仅查看。' },
        ],
      },
      {
        q: '照片',
        p: [
          '打开顶部的照片图标，即可在树中显示头像。',
          '在"资料"中为某人添加照片 — 上传或直接用相机拍摄。',
        ],
      },
      {
        q: '连接家庭（桥接）',
        p: [
          '同一个人是否出现在两个家庭中 — 比如因为一段婚姻？那就建立一座桥：两棵树保持独立，但您可以从一棵跨越到另一棵。',
          '需双方管理员操作：一方生成连接代码，另一方粘贴。',
        ],
        note: '进阶功能 — 入门时无需使用。',
      },
    ],
  },
};

const id: GuideContent = {
  welcome: {
    title: 'Selamat datang di Bloom 🌱',
    intro: 'Bloom menggambar keluarga Anda sebagai jaring hidup di sekitar satu orang — biasanya Anda.',
    leadIn: 'Tiga langkah untuk mulai:',
    steps: [
      { title: 'Ini saya', body: 'Temukan diri Anda di pohon atau buat orang Anda sendiri. Dari situ, setiap hubungan diberi nama: "nenek", "sepupu", "pasangan".' },
      { title: 'Tambah keluarga', body: 'Klik diri Anda dan tambahkan orang tua, pasangan, atau anak. Pohon tumbuh dari sana.' },
      { title: 'Undang yang lain', body: 'Biarkan keluarga ikut membangun — setiap orang menambah apa yang ia tahu.' },
    ],
    start: 'Mulai',
    more: 'Pelajari lebih lanjut',
  },
  guide: {
    title: 'Bagaimana cara kerja Bloom?',
    intro:
      'Bloom adalah pohon keluarga yang berpikir dari sudut pandang: Anda melihat keluarga sebagai jaring di sekitar satu orang, dengan hubungan dinamai sebagaimana Anda mengenalnya.',
    sections: [
      {
        q: 'Dua tampilan',
        p: ['Beralih di kanan atas antara dua cara melihat keluarga Anda.'],
        items: [
          { label: 'Pohon', text: 'tampilan kerja. Di sini Anda menelusuri, mengubah orang, dan melihat foto. Klik seseorang untuk memperbesar.' },
          { label: 'Tablo', text: 'gambaran tenang dan artistik dari seluruh keluarga. Enak dilihat atau dibagikan, bukan untuk diedit.' },
        ],
      },
      {
        q: 'Privasi & visibilitas',
        p: ['Pohon keluarga bersifat pribadi. Anda menentukan siapa melihat apa — per orang dan per hubungan.'],
        blocks: [
          {
            h: 'Tertutup, dengan undangan',
            p: ['Tak seorang pun dapat menemukan atau membuka pohon Anda tanpa undangan. Pengunjung yang belum masuk hanya melihat demo. Anda berbagi lewat tautan; yang mendaftar berstatus menunggu dulu dan baru menjadi anggota setelah admin menyetujui.'],
          },
          {
            h: 'Tiga tingkat visibilitas',
            p: ['Setiap orang — dan setiap hubungan — memiliki visibilitas:'],
            items: [
              { label: 'Publik', text: 'untuk semua orang, bahkan tanpa masuk (untuk yang sengaja Anda bagikan).' },
              { label: 'Keluarga', text: 'untuk semua anggota pohon ini (bawaan).' },
              { label: 'Pribadi', text: 'hanya untuk admin.' },
            ],
            note: 'Jika lebih dari satu pengaturan berlaku, yang paling ketat menang. Contoh: nenek Anda tak ingin tahun lahirnya dibagikan ke seluruh keluarga → setel ke pribadi; hanya admin yang melihatnya.',
          },
          { h: 'Anda menentukan diri sendiri', p: ['Anda selalu boleh menyetel data Anda sendiri lebih ketat daripada yang admin lakukan — meski simpul Anda dikelola orang lain.'] },
          { h: 'Tersembunyi, tapi pohon tetap utuh', p: ['Orang yang dilindungi tidak hilang sepenuhnya: orang lain melihat "orang tersembunyi" di tempat itu, sehingga koneksi — dan siapa berkerabat dengan siapa — tetap benar di pohon Anda sendiri.'] },
          {
            h: 'Fakta bersama',
            p: ['Pernikahan atau ikatan orang tua–anak milik dua orang bersama — sebuah fakta bersama. Ikatan seperti itu tetap terlihat oleh keluarga secara bawaan, agar pohon tetap utuh dan Anda bisa melihat siapa berkerabat dengan siapa.'],
            note: 'Melindungi hubungan satu per satu secara halus — dan menyembunyikan ikatan hanya dengan persetujuan kedua pihak — sudah dirancang tetapi belum ada di versi ini.',
          },
          { h: 'Apa arti "tersembunyi" dan apa bukan', p: ['Menyembunyikan melindungi dari pengintip sepintas dan orang luar. Ini bukan jaminan terhadap anggota keluarga yang berpikir cermat: dari yang terlihat, kadang bisa disimpulkan siapa yang tersembunyi (saudara tiri yang terlihat mengungkap orang tua bersama). Untuk rahasia sejati, lebih baik tidak memasukkan orang itu sama sekali.'] },
        ],
      },
      {
        q: '"Ini saya" dan sudut pandang',
        p: ['Hubungan baru bermakna dari seseorang: "ibu Anna", "sepupu Tom". Karena itu Anda memilih sebuah "saya".'],
        items: [
          { label: 'Ini saya', text: 'menautkan akun Anda ke seseorang — itu menjadi titik awal tetap Anda.' },
          { label: 'Lihat dari …', text: 'membuat Anda sejenak melihat dari mata orang lain. "Kembali ke bawaan" mengembalikan Anda ke diri sendiri.' },
        ],
      },
      {
        q: 'Menambah orang dan hubungan',
        p: [
          'Klik seseorang dan pilih + orang tua, + pasangan, atau + anak. Anda membuat orang baru, atau menautkan seseorang yang sudah ada di keluarga.',
          'Di Data Anda mengisi nama, tahun, dan foto. Di bawah "detail lainnya" ada nama panggilan, nama dalam aksara asli, dan visibilitas.',
        ],
      },
      {
        q: 'Membangun bersama',
        p: ['Pohon keluarga makin kaya dengan lebih banyak orang. Undang keluarga lewat Bagikan.'],
        items: [
          { label: 'Admin', text: 'boleh melakukan segalanya, termasuk mengundang dan menautkan.' },
          { label: 'Editor', text: 'boleh menambah orang dan hubungan.' },
          { label: 'Pembaca', text: 'hanya melihat.' },
        ],
      },
      {
        q: 'Foto',
        p: [
          'Nyalakan ikon foto di atas untuk menampilkan foto profil di pohon.',
          'Anda menambahkan foto ke seseorang di bawah Data — unggah atau langsung dengan kamera.',
        ],
      },
      {
        q: 'Menautkan keluarga (jembatan)',
        p: [
          'Apakah orang yang sama muncul di dua keluarga — misalnya karena pernikahan? Maka Anda membangun jembatan: kedua pohon tetap terpisah, tetapi Anda bisa menyeberang dari satu ke yang lain.',
          'Kedua admin harus melakukannya: yang satu membuat kode taut, yang lain menempelkannya.',
        ],
        note: 'Tingkat lanjut — tidak perlu untuk memulai.',
      },
    ],
  },
};

export const guides: Record<Lang, GuideContent> = { nl, en, zh, id };
