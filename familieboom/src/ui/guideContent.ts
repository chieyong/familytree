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
  /** Alleen in de cloud-versie tonen (weg in de lokale/offline modus). */
  cloudOnly?: boolean;
}

/** Een rijk sub-onderdeel binnen een sectie, met een eigen kopje. */
export interface GuideBlock {
  /** Subkopje. */
  h?: string;
  p?: string[];
  items?: GuideItem[];
  note?: string;
  /** Alleen in de cloud-versie tonen. */
  cloudOnly?: boolean;
}

export interface GuideSection {
  /** Stabiele sleutel (taal-onafhankelijk) om secties te filteren, bv. in de
   *  lokale modus. */
  id?: string;
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
  /** Hele sectie alleen in de cloud-versie tonen (bv. rollen). */
  cloudOnly?: boolean;
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
    /** Vervangt de "Privacy & zichtbaarheid"-sectie in de lokale (offline) modus. */
    localPrivacy: GuideSection;
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
    localPrivacy: {
      q: 'Privacy: alles blijft lokaal',
      p: [
        'Dit is de offline versie. Al je gegevens staan alleen op deze computer — er is geen account, geen internet en geen server. Niets gaat naar de cloud.',
        'De beveiliging hangt dus van je apparaat af: gebruik schijfversleuteling (FileVault) en maak af en toe een back-up via het ⚙-menu → “Back-up opslaan”.',
        'De “familie/privé”-instelling per persoon heeft hier geen effect — er is maar één gebruiker: jij.',
      ],
    },
    sections: [
      {
        q: 'De drie weergaven',
        p: ['Wissel rechtsboven tussen de drie manieren om je familie te bekijken.'],
        items: [
          { label: 'Boom', text: 'de werkweergave. Hier navigeer je, bewerk je personen en bekijk je foto’s. Klik op iemand om in te zoomen.' },
          { label: 'Tableau', text: 'een rustig, artistiek overzicht van de hele familie. Mooi om naar te kijken of te delen, niet om in te werken.' },
          { label: 'Atlas', text: 'een draaibare wereldbol: waar je familie vandaan komt en heen trok — geboorte- en woonplaatsen, met migratie- en levensreis-lagen op de kaart.' },
        ],
      },
      {
        id: 'privacy',
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
              { label: 'Openbaar', text: 'op data-niveau voor iedereen leesbaar, ook zonder login. Wordt momenteel niet meer aangeboden (er is nog geen publieke weergave); bestaande openbare personen kun je terugzetten naar familie of privé.' },
              { label: 'Familie', text: 'voor alle leden van deze boom (standaard).' },
              { label: 'Privé', text: 'alleen voor de beheerder (de eigenaar).' },
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
          { label: 'Dit ben ik', text: 'koppelt je account aan een persoon — dat wordt je vaste vertrekpunt.', cloudOnly: true },
          { label: 'Bekijk vanuit …', text: 'laat je tijdelijk door andermans ogen kijken. Met "terug naar standaard" sta je weer bij jezelf.' },
        ],
      },
      {
        q: 'Personen en relaties toevoegen',
        p: [
          'Klik op een persoon en kies + ouder, + partner of + kind. Je maakt een nieuw persoon aan, of koppelt iemand die al in de familie staat.',
          'In Gegevens vul je voornamen, roepnaam (die in de boom komt), achternaam, jaren en een foto in — en ook bijnaam en naam in eigen schrift. Wijzigingen worden automatisch bewaard.',
        ],
        items: [
          { text: 'Je stelt hier ook de zichtbaarheid in: familie of privé.', cloudOnly: true },
        ],
      },
      {
        cloudOnly: true,
        q: 'Rollen: wie mag wat',
        p: ['Nodig familie uit via Delen. Je kiest per persoon een rol; een beheerder kan rollen later wijzigen — en een ander lid ook tot beheerder maken.'],
        blocks: [
          {
            h: 'Lezer',
            p: ['Kijkt mee, maar verandert niets:'],
            items: [
              { text: 'bekijkt de familie-zichtbare boom' },
              { text: 'mag het eigen "dit ben ik"-knooppunt aanpassen' },
              { text: 'kan niets toevoegen, bewerken of verwijderen; ziet geen privé-personen' },
            ],
          },
          {
            h: 'Bijdrager',
            p: ['Draagt bij via voorstellen — bouwt mee zonder direct te wijzigen:'],
            items: [
              { text: 'stelt wijzigingen aan personen voor' },
              { text: 'stelt nieuwe personen en koppelingen voor' },
              { text: 'een beheerder of bewerker keurt elk voorstel goed of af' },
              { text: 'kan zelf niets direct opslaan; ziet geen privé-personen' },
            ],
          },
          {
            h: 'Bewerker',
            p: ['Bouwt mee aan de inhoud:'],
            items: [
              { text: 'personen toevoegen, bewerken en verwijderen' },
              { text: 'relaties (huwelijk, ouder–kind) beheren, met jaartallen' },
              { text: 'foto’s toevoegen en verwijderen' },
              { text: 'voorstellen van bijdragers goedkeuren of afwijzen' },
              { text: 'familie uitnodigen (als lezer)' },
              { text: 'géén ledenbeheer, familie-instellingen of bruggen; ziet geen privé-personen' },
            ],
          },
          {
            h: 'Beheerder (eigenaar)',
            p: ['Volledige zeggenschap — alles wat een bewerker mag, plus:'],
            items: [
              { text: 'leden uitnodigen, goedkeuren en verwijderen' },
              { text: 'rollen wijzigen, en een ander lid tot beheerder maken' },
              { text: 'de familie hernoemen of verwijderen' },
              { text: 'bruggen naar andere families leggen' },
              { text: 'ziet als enige de privé-personen' },
            ],
          },
        ],
        note: 'Privé zet je per persoon onder Bewerken. Een privé-persoon is alleen voor de beheerder; bewerkers en lezers zien op die plek een "verborgen persoon", zodat de boom blijft kloppen.',
      },
      {
        q: 'Foto’s',
        p: [
          'Zet het foto-icoon bovenin aan om profielfoto’s in de boom te tonen.',
          'Een foto voeg je toe bij een persoon onder Gegevens — uploaden of meteen met de camera.',
        ],
      },
      {
        cloudOnly: true,
        q: 'Personen importeren uit een andere boom',
        p: [
          'Heb je meer dan één eigen boom met overlappende familie? Via het familiemenu → "Personen importeren" neem je een selectie personen over uit een andere boom van jou.',
          'Hun onderlinge relaties komen mee. Staat iemand al in deze boom (herkend op naam en geboortejaar), dan kun je de gekopieerde personen daaraan koppelen, zodat ze niet los komen te staan.',
        ],
        note: 'Alleen voor de beheerder, en alleen uit bomen waarvan je zelf beheerder bent.',
      },
      {
        cloudOnly: true,
        q: 'Families koppelen (bruggen)',
        p: [
          'Komt dezelfde persoon in twee families voor — bijvoorbeeld door een huwelijk? Dan leg je een brug: de twee bomen blijven apart, maar je kunt van de één naar de ander oversteken.',
          'Beide beheerders moeten het doen: de één maakt een koppelcode, de ander plakt ’m.',
          'Een brug kun je later weer ontkoppelen via het persoonspaneel (beheerder).',
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
    localPrivacy: {
      q: 'Privacy: everything stays local',
      p: [
        'This is the offline version. All your data lives only on this computer — no account, no internet, no server. Nothing goes to the cloud.',
        'Security therefore depends on your device: use disk encryption (FileVault) and make a backup now and then via the ⚙ menu → “Save backup”.',
        'The per-person “family/private” setting has no effect here — there is only one user: you.',
      ],
    },
    sections: [
      {
        q: 'The three views',
        p: ['Switch top right between the three ways to view your family.'],
        items: [
          { label: 'Tree', text: 'the working view. Here you navigate, edit people and see photos. Click someone to zoom in.' },
          { label: 'Tableau', text: 'a calm, artistic overview of the whole family. Nice to look at or share, not to work in.' },
          { label: 'Atlas', text: 'a rotatable globe: where your family came from and moved to — birth and residence places, with migration and life-journey layers on the map.' },
        ],
      },
      {
        id: 'privacy',
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
              { label: 'Public', text: 'readable by anyone at the data level, even without login. Currently no longer offered (there is no public view yet); existing public people can be set back to family or private.' },
              { label: 'Family', text: 'for all members of this tree (the default).' },
              { label: 'Private', text: 'for the admin (the owner) only.' },
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
          { label: 'This is me', text: 'links your account to a person — that becomes your fixed starting point.', cloudOnly: true },
          { label: 'View from …', text: 'lets you temporarily look through someone else’s eyes. "Back to default" returns you to yourself.' },
        ],
      },
      {
        q: 'Adding people and relationships',
        p: [
          'Click a person and choose + parent, + partner or + child. You create a new person, or link someone already in the family.',
          'In Details you fill in given names, a call name (shown in the tree), family name, years and a photo — plus nickname and name in native script. Changes are saved automatically.',
        ],
        items: [
          { text: 'You also set the visibility here: family or private.', cloudOnly: true },
        ],
      },
      {
        cloudOnly: true,
        q: 'Roles: who can do what',
        p: ['Invite family via Share. You pick a role per person; an admin can change roles later — and also make another member an admin.'],
        blocks: [
          {
            h: 'Reader',
            p: ['Looks on, but changes nothing:'],
            items: [
              { text: 'views the family-visible tree' },
              { text: 'may edit their own "this is me" node' },
              { text: 'cannot add, edit or delete anything; does not see private people' },
            ],
          },
          {
            h: 'Contributor',
            p: ['Contributes via proposals — helps build without changing directly:'],
            items: [
              { text: 'proposes changes to people' },
              { text: 'proposes new people and links' },
              { text: 'an admin or editor approves or rejects each proposal' },
              { text: 'cannot save anything directly; does not see private people' },
            ],
          },
          {
            h: 'Editor',
            p: ['Builds the content:'],
            items: [
              { text: 'add, edit and delete people' },
              { text: 'manage relationships (marriage, parent–child), with years' },
              { text: 'add and remove photos' },
              { text: 'approve or reject contributors’ proposals' },
              { text: 'invite family (as readers)' },
              { text: 'no member management, family settings or bridges; does not see private people' },
            ],
          },
          {
            h: 'Admin (owner)',
            p: ['Full control — everything an editor can do, plus:'],
            items: [
              { text: 'invite, approve and remove members' },
              { text: 'change roles, and make another member an admin' },
              { text: 'rename or delete the family' },
              { text: 'build bridges to other families' },
              { text: 'the only one who sees private people' },
            ],
          },
        ],
        note: 'You set private per person under Edit. A private person is for the admin only; editors and readers see a "hidden person" in that spot, so the tree still holds.',
      },
      {
        q: 'Photos',
        p: [
          'Turn on the photo icon at the top to show profile photos in the tree.',
          'You add a photo to a person under Details — upload or straight from the camera.',
        ],
      },
      {
        cloudOnly: true,
        q: 'Importing people from another tree',
        p: [
          'Have more than one tree of your own with overlapping family? Via the family menu → "Import people" you bring a selection of people over from another tree of yours.',
          'Their mutual relationships come along. If someone is already in this tree (matched on name and birth year), you can connect the imported people to them, so they don’t end up loose.',
        ],
        note: 'Admin only, and only from trees you own yourself.',
      },
      {
        cloudOnly: true,
        q: 'Linking families (bridges)',
        p: [
          'Does the same person appear in two families — through a marriage, say? Then you build a bridge: the two trees stay separate, but you can cross from one to the other.',
          'Both admins must do it: one creates a link code, the other pastes it.',
          'You can unlink a bridge later from the person panel (admin).',
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
    localPrivacy: {
      q: '隐私：一切都在本地',
      p: [
        '这是离线版本。您的所有数据仅保存在这台电脑上——没有账户、没有联网、没有服务器，什么都不会上传到云端。',
        '因此安全性取决于您的设备：请使用磁盘加密（FileVault），并不时通过 ⚙ 菜单 →“保存备份”做一次备份。',
        '此处每个人的“家庭/私密”设置没有作用——因为只有一个用户：您。',
      ],
    },
    sections: [
      {
        q: '三种视图',
        p: ['在右上角切换三种查看家庭的方式。'],
        items: [
          { label: '树状图', text: '工作视图。在此导航、编辑人物并查看照片。点击某人即可放大。' },
          { label: '画卷', text: '整个家庭的宁静、艺术化概览。适合观赏或分享，而非编辑。' },
          { label: '地图集', text: '可旋转的地球：您的家族从何而来、迁往何处——出生地与居住地，并在地图上叠加迁徙与人生旅程图层。' },
        ],
      },
      {
        id: 'privacy',
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
              { label: '公开', text: '在数据层面所有人可读，无需登录。目前已不再提供（尚无公开视图）；已有的公开人物可改回家庭或私密。' },
              { label: '家庭', text: '本树所有成员可见（默认）。' },
              { label: '私密', text: '仅管理员（所有者）可见。' },
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
          { label: '这是我', text: '将您的账号关联到某个人 — 这将成为您固定的出发点。', cloudOnly: true },
          { label: '从…的视角', text: '让您暂时以他人的眼光来看。点击"恢复默认"即可回到自己。' },
        ],
      },
      {
        q: '添加人物与关系',
        p: [
          '点击一个人，选择 +父母、+伴侣或+子女。您可以新建一个人物，或关联家庭中已有的人。',
          '在"资料"中填写名字、常用名（显示在树中）、姓氏、年份和照片——以及昵称和母语文字姓名。更改会自动保存。',
        ],
        items: [
          { text: '您也在此设置可见性：家庭或私密。', cloudOnly: true },
        ],
      },
      {
        cloudOnly: true,
        q: '角色：谁能做什么',
        p: ['通过"分享"邀请家人。可为每个人选择角色；管理员之后可更改角色——也可把另一位成员设为管理员。'],
        blocks: [
          {
            h: '读者',
            p: ['只看，不做任何更改：'],
            items: [
              { text: '查看家庭可见的树' },
              { text: '可编辑自己的"这是我"节点' },
              { text: '不能添加、编辑或删除任何内容；看不到私密人物' },
            ],
          },
          {
            h: '贡献者',
            p: ['通过提议参与——共建但不直接修改：'],
            items: [
              { text: '提议修改人物' },
              { text: '提议新增人物和关联' },
              { text: '由管理员或编辑者批准或拒绝每条提议' },
              { text: '不能直接保存任何内容；看不到私密人物' },
            ],
          },
          {
            h: '编辑者',
            p: ['共建内容：'],
            items: [
              { text: '添加、编辑和删除人物' },
              { text: '管理关系（婚姻、亲子），含年份' },
              { text: '添加和删除照片' },
              { text: '批准或拒绝贡献者的提议' },
              { text: '邀请家人（作为读者）' },
              { text: '不涉及成员管理、家庭设置或桥接；看不到私密人物' },
            ],
          },
          {
            h: '管理员（所有者）',
            p: ['拥有完全控制权——编辑者能做的一切，另外还可：'],
            items: [
              { text: '邀请、批准和移除成员' },
              { text: '更改角色，并把另一位成员设为管理员' },
              { text: '重命名或删除家庭' },
              { text: '与其他家庭建立桥接' },
              { text: '唯一能看到私密人物的人' },
            ],
          },
        ],
        note: '在"编辑"中为每个人设置私密。私密人物仅管理员可见；编辑者和读者在该位置看到"隐藏人物"，以便家谱依然成立。',
      },
      {
        q: '照片',
        p: [
          '打开顶部的照片图标，即可在树中显示头像。',
          '在"资料"中为某人添加照片 — 上传或直接用相机拍摄。',
        ],
      },
      {
        cloudOnly: true,
        q: '从另一棵树导入人物',
        p: [
          '你有不止一棵存在重叠亲属的自己的树吗？通过家庭菜单 →"导入人物"，可从你自己的另一棵树中选取人物导入。',
          '他们之间的关系会一并导入。若某人已在本树中（按姓名与出生年份识别），可将导入的人物与其关联，避免出现孤立人物。',
        ],
        note: '仅管理员可用，且只能从你自己作为管理员的树导入。',
      },
      {
        cloudOnly: true,
        q: '连接家庭（桥接）',
        p: [
          '同一个人是否出现在两个家庭中 — 比如因为一段婚姻？那就建立一座桥：两棵树保持独立，但您可以从一棵跨越到另一棵。',
          '需双方管理员操作：一方生成连接代码，另一方粘贴。',
          '之后也可在人物面板中解除桥接（管理员）。',
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
    localPrivacy: {
      q: 'Privasi: semua tetap lokal',
      p: [
        'Ini versi offline. Semua data Anda hanya ada di komputer ini — tanpa akun, tanpa internet, tanpa server. Tidak ada yang dikirim ke cloud.',
        'Karena itu keamanan bergantung pada perangkat Anda: gunakan enkripsi disk (FileVault) dan buat cadangan sesekali via menu ⚙ → “Simpan cadangan”.',
        'Pengaturan “keluarga/pribadi” per orang tidak berpengaruh di sini — hanya ada satu pengguna: Anda.',
      ],
    },
    sections: [
      {
        q: 'Tiga tampilan',
        p: ['Beralih di kanan atas antara tiga cara melihat keluarga Anda.'],
        items: [
          { label: 'Pohon', text: 'tampilan kerja. Di sini Anda menelusuri, mengubah orang, dan melihat foto. Klik seseorang untuk memperbesar.' },
          { label: 'Tablo', text: 'gambaran tenang dan artistik dari seluruh keluarga. Enak dilihat atau dibagikan, bukan untuk diedit.' },
          { label: 'Atlas', text: 'bola dunia yang dapat diputar: dari mana keluarga Anda berasal dan ke mana mereka pindah — tempat lahir dan tempat tinggal, dengan lapisan migrasi dan perjalanan hidup di peta.' },
        ],
      },
      {
        id: 'privacy',
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
              { label: 'Publik', text: 'dapat dibaca siapa pun di tingkat data, bahkan tanpa masuk. Saat ini tidak lagi ditawarkan (belum ada tampilan publik); orang yang sudah publik bisa dikembalikan ke keluarga atau pribadi.' },
              { label: 'Keluarga', text: 'untuk semua anggota pohon ini (bawaan).' },
              { label: 'Pribadi', text: 'hanya untuk admin (pemilik).' },
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
          { label: 'Ini saya', text: 'menautkan akun Anda ke seseorang — itu menjadi titik awal tetap Anda.', cloudOnly: true },
          { label: 'Lihat dari …', text: 'membuat Anda sejenak melihat dari mata orang lain. "Kembali ke bawaan" mengembalikan Anda ke diri sendiri.' },
        ],
      },
      {
        q: 'Menambah orang dan hubungan',
        p: [
          'Klik seseorang dan pilih + orang tua, + pasangan, atau + anak. Anda membuat orang baru, atau menautkan seseorang yang sudah ada di keluarga.',
          'Di Data Anda mengisi nama depan, nama panggilan (tampil di pohon), nama keluarga, tahun, dan foto — juga julukan dan nama dalam aksara asli. Perubahan tersimpan otomatis.',
        ],
        items: [
          { text: 'Anda juga mengatur visibilitas di sini: keluarga atau pribadi.', cloudOnly: true },
        ],
      },
      {
        cloudOnly: true,
        q: 'Peran: siapa boleh apa',
        p: ['Undang keluarga lewat Bagikan. Anda memilih peran per orang; admin dapat mengubah peran nanti — dan juga menjadikan anggota lain admin.'],
        blocks: [
          {
            h: 'Pembaca',
            p: ['Menyaksikan, tetapi tidak mengubah apa pun:'],
            items: [
              { text: 'melihat pohon yang terlihat untuk keluarga' },
              { text: 'boleh menyunting simpul "ini saya" sendiri' },
              { text: 'tidak bisa menambah, mengubah, atau menghapus apa pun; tidak melihat orang pribadi' },
            ],
          },
          {
            h: 'Kontributor',
            p: ['Berkontribusi lewat usulan — ikut membangun tanpa mengubah langsung:'],
            items: [
              { text: 'mengusulkan perubahan pada orang' },
              { text: 'mengusulkan orang dan tautan baru' },
              { text: 'admin atau editor menyetujui atau menolak setiap usulan' },
              { text: 'tidak bisa menyimpan apa pun secara langsung; tidak melihat orang pribadi' },
            ],
          },
          {
            h: 'Editor',
            p: ['Membangun isi:'],
            items: [
              { text: 'menambah, mengubah, dan menghapus orang' },
              { text: 'mengelola hubungan (pernikahan, orang tua–anak), dengan tahun' },
              { text: 'menambah dan menghapus foto' },
              { text: 'menyetujui atau menolak usulan kontributor' },
              { text: 'mengundang keluarga (sebagai pembaca)' },
              { text: 'tanpa pengelolaan anggota, pengaturan keluarga, atau jembatan; tidak melihat orang pribadi' },
            ],
          },
          {
            h: 'Admin (pemilik)',
            p: ['Kendali penuh — semua yang bisa editor lakukan, ditambah:'],
            items: [
              { text: 'mengundang, menyetujui, dan menghapus anggota' },
              { text: 'mengubah peran, dan menjadikan anggota lain admin' },
              { text: 'mengganti nama atau menghapus keluarga' },
              { text: 'membangun jembatan ke keluarga lain' },
              { text: 'satu-satunya yang melihat orang pribadi' },
            ],
          },
        ],
        note: 'Pribadi diatur per orang di bawah Ubah. Orang pribadi hanya untuk admin; editor dan pembaca melihat "orang tersembunyi" di tempat itu, agar pohon tetap utuh.',
      },
      {
        q: 'Foto',
        p: [
          'Nyalakan ikon foto di atas untuk menampilkan foto profil di pohon.',
          'Anda menambahkan foto ke seseorang di bawah Data — unggah atau langsung dengan kamera.',
        ],
      },
      {
        cloudOnly: true,
        q: 'Mengimpor orang dari pohon lain',
        p: [
          'Punya lebih dari satu pohon sendiri dengan keluarga yang tumpang tindih? Lewat menu keluarga → "Impor orang" Anda membawa sejumlah orang dari pohon Anda yang lain.',
          'Hubungan di antara mereka ikut terbawa. Jika seseorang sudah ada di pohon ini (dicocokkan berdasarkan nama dan tahun lahir), Anda dapat menautkan orang yang diimpor kepadanya, agar tidak terlepas sendiri.',
        ],
        note: 'Hanya admin, dan hanya dari pohon yang Anda miliki sendiri.',
      },
      {
        cloudOnly: true,
        q: 'Menautkan keluarga (jembatan)',
        p: [
          'Apakah orang yang sama muncul di dua keluarga — misalnya karena pernikahan? Maka Anda membangun jembatan: kedua pohon tetap terpisah, tetapi Anda bisa menyeberang dari satu ke yang lain.',
          'Kedua admin harus melakukannya: yang satu membuat kode taut, yang lain menempelkannya.',
          'Tautan jembatan dapat dilepas lagi nanti dari panel orang (admin).',
        ],
        note: 'Tingkat lanjut — tidak perlu untuk memulai.',
      },
    ],
  },
};

export const guides: Record<Lang, GuideContent> = { nl, en, zh, id };
