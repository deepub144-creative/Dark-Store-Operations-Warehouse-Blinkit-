"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";
import { broadcastEvent, subscribeToEvents, saveLiveOrder } from "@/lib/realtimeSync";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import { getRandomStagingRack } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import {
  IconLightning,
  IconHome,
  IconBriefcase,
  IconMapPin,
  IconCartBag,
  IconSearch,
  IconCoupon,
  IconBellOff,
  IconDoor,
  IconPhoneOff,
  IconMic,
  IconPaw,
  IconWallet,
  IconCreditCard,
  IconCash,
  IconUpi,
  IconCheck,
  IconShieldCheck,
  IconChevronDown,
  IconArrowRight,
  IconArrowLeft,
  IconClose,
  IconClock,
  IconTag,
  IconAlertTriangle,
} from "@/components/RealIcons";

const WALLET_LIMIT = 1000000;
const FREE_DELIVERY_THRESHOLD = 199;

const SAVED_ADDRESSES = [
  {
    id: "addr_kfgsc",
    type: "KFGSC Delivery Point",
    title: "KFGSC Delivery Point",
    flat: "KFGSC Campus Hub",
    address: "KFGSC , Tiptur 572201",
    tag: "Fixed Location",
    iconType: "home",
  },
];

const AVAILABLE_COUPONS = [
  {
    code: "TIPTUR10",
    label: "10% Instant Discount",
    description: "Save 10% up to ₹50 on authentic Tiptur Hub KA - 44 orders",
    minOrder: 149,
    discountPct: 10,
    maxDiscount: 50,
  },
  {
    code: "WELCOME50",
    label: "Flat ₹50 OFF",
    description: "Flat ₹50 savings on your express dark store order",
    minOrder: 199,
    flatDiscount: 50,
  },
  {
    code: "KA44EXPRESS",
    label: "FREE Delivery & Handling",
    description: "100% Free delivery & ₹0 platform fee across Tiptur Hub KA - 44",
    minOrder: 99,
    freeDelivery: true,
    freeHandling: true,
  },
];

const DELIVERY_INSTRUCTIONS_LIST = [
  { id: "avoid_bell", iconType: "bell_off", label: "Avoid ringing bell" },
  { id: "leave_door", iconType: "door", label: "Leave at door / guard" },
  { id: "do_not_call", iconType: "phone_off", label: "Do not call" },
  { id: "directions", iconType: "mic", label: "Directions to reach / Audio note" },
  { id: "pet_home", iconType: "paw", label: "Pet at home / No horn" },
];

// ── EXPLORE NAMMA TIPTUR DATA (Restaurants, Cafes, Organic Farm & 96-Yr Ganesha Festival) ──
const TIPTUR_GANESHA_INFO = {
  titleEn: "The Tiptur Ganesha Utsava Sri Sathya Ganapathi Jatre",
  titleKn: "ತಿಪಟೂರು ಗಣೇಶ ಉತ್ಸವ ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ ಜಾತ್ರೆ",
  titleHi: "तिपतूर गणेश उत्सव श्री सत्य गणपति जात्रा",
  yearsBadge: "96+ Years of Grand Heritage Since 1929",
  mantapa: "Sri Sathya Ganapathi Aasthana Mantapa",
  visarjanLocation: "Historic Tiptur Amanikere Lake",
  image: "/images/tipturganesha.jpg",
  englishStory: [
    "The Tiptur Ganesha Utsava Sri Sathya Ganapathi Jatre is a historic festival celebrated in Tiptur, Karnataka, dating back to 1929 during the pre independence era. Initiated to unite people under Balagangadhar Tilak's national call, this grand public celebration has run consecutively for over 96 years.",
    "Unlike standard celebrations where idols are immersed within days, Tiptur follows a rare tradition where a colossal Ganesha idol is worshipped for nearly three months. Installed at the Sri Sathya Ganapathi Aasthana Mantapa during Ganesha Chaturthi, the pandal becomes a massive cultural hub hosting daily rituals, traditional bhajans, and music concerts.",
    "The festival culminates in a spectacular high energy 24 hour nonstop grand procession through the beautifully illuminated streets of the town. Tens of thousands of devotees gather to witness the colossal chariot, accompanied by traditional folk artists, native drumming troupes, and modern laser and sound shows. The grand event finally concludes with a ritual immersion Visarjan at the historic Tiptur Amanikere lake, making it one of the largest and most vibrant carnival style festivals in the entire region.",
  ],
  kannadaStory: [
    "ತಿಪಟೂರು ಗಣೇಶ ಉತ್ಸವ ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ ಜಾತ್ರೆ ಕರ್ನಾಟಕದ ತಿಪಟೂರಿನಲ್ಲಿ ಆಚರಿಸಲಾಗುವ ಐತಿಹಾಸಿಕ ಮಹೋತ್ಸವವಾಗಿದ್ದು, ಸ್ವಾತಂತ್ರ್ಯ ಪೂರ್ವದ 1929 ರಷ್ಟು ಹಿಂದಿನ ಭವ್ಯ ಇತಿಹಾಸವನ್ನು ಹೊಂದಿದೆ. ಲೋಕಮಾನ್ಯ ಬಾಲಗಂಗಾಧರ ತಿಲಕರ ರಾಷ್ಟ್ರೀಯ ಕರೆಯ ಮೇರೆಗೆ ಜನರನ್ನು ಒಗ್ಗೂಡಿಸಲು ಪ್ರಾರಂಭವಾದ ಈ ಸಾರ್ವಜನಿಕ ಮಹೋತ್ಸವವು ನಿರಂತರವಾಗಿ 96 ವರ್ಷಗಳಿಗೂ ಹೆಚ್ಚು ಕಾಲ ವೈಭವದಿಂದ ಜರುಗುತ್ತಿದೆ.",
    "ಸಾಮಾನ್ಯವಾಗಿ ಕೆಲವೇ ದಿನಗಳಲ್ಲಿ ಗಣೇಶ ಮೂರ್ತಿಯನ್ನು ವಿಸರ್ಜಿಸುವ ಪದ್ಧತಿಗೆ ಭಿನ್ನವಾಗಿ, ತಿಪಟೂರಿನಲ್ಲಿ ಬೃಹತ್ ಗಣೇಶನ ಮೂರ್ತಿಯನ್ನು ಸುಮಾರು ಮೂರು ತಿಂಗಳುಗಳ ಕಾಲ ಭಕ್ತಿಪೂರ್ವಕವಾಗಿ ಪೂಜಿಸುವ ವಿಶಿಷ್ಟ ಸಂಪ್ರದಾಯವಿದೆ. ಗಣೇಶ ಚತುರ್ಥಿಯಂದು ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ ಆಸ್ಥಾನ ಮಂಟಪದಲ್ಲಿ ಪ್ರತಿಷ್ಠಾಪನೆಗೊಳ್ಳುವ ಈ ಪೆಂಡಾಲ್ ಪ್ರತಿದಿನದ ಧಾರ್ಮಿಕ ಪೂಜೆಗಳು, ಸಾಂಪ್ರದಾಯಿಕ ಭಜನೆಗಳು ಮತ್ತು ಸಂಗೀತ ಕಛೇರಿಗಳೊಂದಿಗೆ ಬೃಹತ್ ಸಾಂಸ್ಕೃತಿಕ ಕೇಂದ್ರವಾಗಿ ಕಂಗೊಳಿಸುತ್ತದೆ.",
    "ಈ ಮಹೋತ್ಸವವು ನಗರದ ವಿದ್ಯುದ್ದೀಪಾಲಂಕೃತ ಬೀದಿಗಳಲ್ಲಿ 24 ಗಂಟೆಗಳ ಕಾಲ ಸತತವಾಗಿ ನಡೆಯುವ ವೈಭವೋಪೇತ ಮಹಾ ರಥೋತ್ಸವ ಹಾಗೂ ಶೋಭಾಯಾತ್ರೆಯೊಂದಿಗೆ ಪರಾಕಾಷ್ಠೆ ತಲುಪುತ್ತದೆ. ಸಾಂಪ್ರದಾಯಿಕ ಜಾನಪದ ಕಲಾತಂಡಗಳು, ನಾಸಿಕ್ ಡೋಲ್ ಮತ್ತು ಆಧುನಿಕ ಲೇಸರ್ ಧ್ವನಿ ಬೆಳಕಿನ ಪ್ರದರ್ಶನದ ನಡುವೆ ಸಹಸ್ರಾರು ಭಕ್ತರು ಈ ಭವ್ಯ ರಥಯಾತ್ರೆಯನ್ನು ಕಣ್ತುಂಬಿಕೊಳ್ಳುತ್ತಾರೆ. ಅಂತಿಮವಾಗಿ ಐತಿಹಾಸಿಕ ತಿಪಟೂರು ಅಮಾನಿಕೆರೆಯಲ್ಲಿ ಭಕ್ತಿಪೂರ್ವಕ ಗಣೇಶ ವಿಸರ್ಜನೆಯೊಂದಿಗೆ ಈ ಮಹೋತ್ಸವ ಸಂಪನ್ನಗೊಳ್ಳುತ್ತದೆ, ಇದು ಇಡೀ ಪ್ರಾಂತ್ಯದಲ್ಲೇ ಅತ್ಯಂತ ದೊಡ್ಡ ಮತ್ತು ಅದ್ಧೂರಿ ಕಾರ್ನಿವಲ್ ಶೈಲಿಯ ಹಬ್ಬಗಳಲ್ಲಿ ಒಂದಾಗಿದೆ.",
  ],
  hindiStory: [
    "तिपतूर गणेश उत्सव श्री सत्य गणपति जात्रा कर्नाटक के तिपतूर में मनाया जाने वाला एक ऐतिहासिक महापर्व है, जिसका गौरवशाली इतिहास स्वतंत्रता पूर्व 1929 से जुड़ा है। लोकमान्य बालगंगाधर तिलक के राष्ट्रीय आह्वान पर लोगों को एकजुट करने के लिए शुरू हुआ यह भव्य सार्वजनिक उत्सव लगातार 96 से अधिक वर्षों से धूमधाम से मनाया जा रहा है।",
    "आमतौर पर कुछ ही दिनों में मूर्ति विसर्जन की परंपरा से भिन्न, तिपतूर में एक दुर्लभ परंपरा का पालन किया जाता है जहाँ भगवान गणेश की एक विशालकाय प्रतिमा की लगभग तीन महीनों तक पूरे विधि विधान से पूजा की जाती है। गणेश चतुर्थी पर श्री सत्य गणपति आस्थान मंडप में स्थापित होने वाला यह भव्य पंडाल दैनिक अनुष्ठानों, पारंपरिक भजनों और संगीत समारोहों का एक विशाल सांस्कृतिक केंद्र बन जाता है।",
    "यह उत्सव शहर की रोशनी से जगमगाती सड़कों पर 24 घंटे की अनवरत और ऊर्जावान भव्य शोभायात्रा रथोत्सव के साथ अपने चरम पर पहुंचता है। विशाल रथ के दर्शन के लिए हजारों श्रद्धालु उमड़ते हैं, जिसमें पारंपरिक लोक कलाकार, स्थानीय ढोल ताशा वादक और आधुनिक लेजर और साउंड शो शामिल होते हैं। अंततः यह भव्य उत्सव ऐतिहासिक तिपतूर अमानिकेरे झील में धार्मिक विसर्जन के साथ संपन्न होता है, जो इसे इस पूरे क्षेत्र के सबसे बड़े कार्निवल शैली के त्योहारों में से एक बनाता है।",
  ],
  stats: [
    { label: "Heritage Era", val: "1929 Pre Independence", knVal: "1929 ಸ್ವಾತಂತ್ರ್ಯ ಪೂರ್ವ", hiVal: "1929 स्वतंत्रता पूर्व" },
    { label: "Worship Duration", val: "3 Months in Mantapa", knVal: "3 ತಿಂಗಳ ನಿರಂತರ ಪೂಜೆ", hiVal: "3 महीने आस्थान मंडप में" },
    { label: "Procession", val: "24 Hour Nonstop Rathotsava", knVal: "24 ಗಂಟೆಗಳ ಮಹಾ ರಥೋತ್ಸವ", hiVal: "24 घंटे अनवरत रथोत्सव" },
    { label: "Visarjan", val: "Historic Amanikere Lake", knVal: "ಐತಿಹಾಸಿಕ ಅಮಾನಿಕೆರೆ", hiVal: "ऐतिहासिक अमानिकेरे झील" },
  ],
};

const JSDELIVR_PUBLIC_CDN = "https://cdn.jsdelivr.net/gh/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-@main/public";

const MERGED_BACKGROUND_VIDEOS = [
  { id: "v1", src: "/videos/v1.mp4", fallback: `${JSDELIVR_PUBLIC_CDN}/videos/v1.mp4`, durationLimit: 21.6 },
  { id: "v2", src: "/videos/v2.mp4", fallback: `${JSDELIVR_PUBLIC_CDN}/videos/v2.mp4`, durationLimit: 5.3 },
];

const TIPTUR_RESTAURANTS = [
  {
    name: "Kalpataru Grand",
    type: "Fine Dining",
    desc: "Luxury family dining, North & South Indian delights, Tandoori, Mughlai & Biryani specials",
    loc: "Near Kalpataru College Road, Tiptur",
    rating: "4.5",
    color: "#B45309",
    bg: "#FEF3C7",
    image: "/images/kalpataru-grand.jpg",
    imagePos: "center 22%",
  },
  {
    name: "Malgudi Days",
    type: "Heritage Dining",
    desc: "Thematic Karnataka heritage restaurant, authentic coastal flavors, special rotis & curries",
    loc: "Main Road, Tiptur",
    rating: "4.4",
    color: "#7E22CE",
    bg: "#FAF5FF",
    image: "/images/malgudidays.jpg",
  },
  {
    name: "City Garden",
    type: "Garden Restaurant",
    desc: "Lush outdoor garden seating, family dining lawns, paneer sizzlers & Dum Biryani",
    loc: "Near APMC Circle, Tiptur",
    rating: "4.3",
    color: "#0369A1",
    bg: "#E0F2FE",
    image: "/images/citygarden.jpg",
    imagePos: "center 38%",
  },
  {
    name: "Athithya",
    type: "Pure Veg Family",
    desc: "Pure vegetarian family favorite, delicious Tumkur thali, quick dosas & hygienic service",
    loc: "B.H. Road, Near KSRTC Bus Stand, Tiptur",
    rating: "4.5",
    color: "#C2410C",
    bg: "#FFEDD5",
    image: "/images/Athithya.png",
  },
];

const TIPTUR_CAFES = [
  {
    name: "Soda Point",
    type: "Local Legend",
    desc: "Legendary fruit fizz sodas, cold refreshments & vibrant youth adda",
    rating: "4.7",
    color: "#0284C7",
    bg: "#E0F2FE",
    image: "/images/soda-point.png",
  },
  {
    name: "Karunada Cafe",
    type: "Traditional Coffee",
    desc: "Authentic aromatic filter coffee, lemon tea & hot evening snacks",
    rating: "4.6",
    color: "#15803D",
    bg: "#DCFCE7",
    image: "/images/karunada cafe.jpg",
  },
  {
    name: "Juicy Lounge",
    type: "Fresh Sips & Shakes",
    desc: "Cold fresh seasonal fruit juices, thick shakes, smoothies & royal faloodas",
    rating: "4.5",
    color: "#D97706",
    bg: "#FEF3C7",
    image: "/images/juicy-lounge.png",
  },
  {
    name: "Salgara",
    type: "Bakery & Cafe",
    desc: "Warm oven-fresh puffs, pastries, butter cookies & traditional tea",
    rating: "4.4",
    color: "#7E22CE",
    bg: "#FAF5FF",
    image: "/images/salagar-chai-and-coffee-tiptur-.jpg",
  },
  {
    name: "Cosmic cafe",
    type: "Modern Vibes",
    desc: "Aesthetic cafe experience, specialty cold coffees & continental bites",
    rating: "4.5",
    color: "#BE185D",
    bg: "#FDF2F8",
    image: "/images/cosmiccafe.jpg",
    imagePos: "center 18%",
  },
  {
    name: "Lucky Cafe",
    type: "Heritage Chai Adda",
    desc: "Classic chai, bun butter jam, Irani tea vibes & morning crowd staple",
    rating: "4.4",
    color: "#B45309",
    bg: "#FEF3C7",
    image: "/images/lucky-cafe.png",
  },
  {
    name: "The Engineers Cafe",
    type: "Student Hotspot",
    desc: "Loaded burgers, peri-peri fries, cold brews & evening collegiate hangout",
    rating: "4.6",
    color: "#4338CA",
    bg: "#EEF2FF",
    image: "/images/engineers-cafe.jpg",
  },
  {
    name: "1952cofee",
    type: "Artisanal Brews",
    desc: "Vintage brewing craftsmanship, artisanal South Indian roasts & filter coffee",
    rating: "4.7",
    color: "#92400E",
    bg: "#FEF3C7",
    image: "/images/1952-coffee.png",
    imagePos: "center 48%",
  },
  {
    name: "Has#tag Cafe",
    type: "Trending Youth",
    desc: "Creative mocktails, thin crust pizzas, spicy finger foods & lively vibes",
    rating: "4.5",
    color: "#BE123C",
    bg: "#FFE4E6",
    image: "/images/hashtag-cafe.png",
    imagePos: "center 30%",
  },
];

const TIPTUR_FARMS = [
  {
    name: "Akshayakalpa Organic Farm",
    type: "Certified Organic Agro Farm",
    badge: "India's 1st Certified Organic Dairy",
    video: "/videos/AK.mp4",
    videoBadge: "1080p HD Agro Ecological Drone Tour",
    desc: "India's pioneer certified organic dairy and agro ecological farm located in the Tiptur rural belt. Famous for zero antibiotic, zero synthetic hormone organic cow milk, country ghee, curd, artisanal paneer, and educational farm tours preserving indigenous cattle breeds and living soil.",
    loc: "Tiptur Rural Belt, Tumkur District 572201",
    highlights: [
      "100% Certified Organic Dairy & Country Ghee",
      "Zero Antibiotics, Synthetic Hormones or Chemical Fertilizers",
      "Indigenous Cow Breeds & Ethical Milking Practices",
      "Guided Agro Ecological Farm Immersion & Heritage Tours",
    ],
    rating: "4.9 ★ Certified Organic",
    color: "#15803D",
    bg: "#F0FDF4",
  },
];

export default function OrderingAppPage() {
  const router = useRouter();

  // Core Data
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("Chocolates");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [oosList, setOosList] = useState([]);

  // Blinkit Cart & Checkout Flow State
  const [isCheckoutView, setIsCheckoutView] = useState(false); // Can view either Catalog or pure Checkout
  const [activeBottomTab, setActiveBottomTab] = useState("home"); // 'home' | 'order_again' | 'categories' | 'explore_tiptur'
  const [selectedAddress, setSelectedAddress] = useState(SAVED_ADDRESSES[0]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState(["avoid_bell", "leave_door"]);
  const [appliedCoupon, setAppliedCoupon] = useState(AVAILABLE_COUPONS[0]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("upi"); // 'upi' | 'wallet' | 'card' | 'cod'
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay"); // 'gpay' | 'phonepe' | 'paytm' | 'cred'
  const [ganeshaLang, setGaneshaLang] = useState("english"); // 'english' | 'kannada' | 'hindi'
  const [bgVideoIdx, setBgVideoIdx] = useState(0);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Profile & Customer Login State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginStep, setLoginStep] = useState("phone"); // 'phone' | 'otp' | 'name'
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginDemoOtp, setLoginDemoOtp] = useState("442201");

  // Typewriter Search Box Effect (cycles through stored warehouse items)
  const STORED_SEARCH_ITEMS = useMemo(() => [
    "Beatss Milk Chocolate",
    "Kantara A4 Glass Frame",
    "Melody Chocolaty Toffee",
    "Yash KGF Glass Frame",
    "Kopiko Coffee Candy",
    "D Boss A4 Glass Frame",
    "Boomer Bubble Gum",
    "Mahadev Shiva Glass Frame",
    "Candyman Choco Double",
    "Anime Glass Frame",
    "Eclairs Rich Toffee",
    "Coding & Tech Glass Frame",
  ], []);

  const [typewriterPlaceholder, setTypewriterPlaceholder] = useState('Search "Beatss Milk Chocolate"...');
  const [typeItemIdx, setTypeItemIdx] = useState(0);
  const [isDeletingChar, setIsDeletingChar] = useState(false);
  const [charPos, setCharPos] = useState(0);

  useEffect(() => {
    const curItem = STORED_SEARCH_ITEMS[typeItemIdx % STORED_SEARCH_ITEMS.length];
    const fullSearchPrompt = `Search "${curItem}"...`;

    const timer = setTimeout(() => {
      if (!isDeletingChar) {
        if (charPos < fullSearchPrompt.length) {
          setCharPos((prev) => prev + 1);
          setTypewriterPlaceholder(fullSearchPrompt.slice(0, charPos + 1));
        } else {
          setTimeout(() => setIsDeletingChar(true), 1600);
        }
      } else {
        if (charPos > 9) { // keep 'Search "'
          setCharPos((prev) => prev - 1);
          setTypewriterPlaceholder(fullSearchPrompt.slice(0, charPos - 1));
        } else {
          setIsDeletingChar(false);
          setTypeItemIdx((prev) => (prev + 1) % STORED_SEARCH_ITEMS.length);
        }
      }
    }, isDeletingChar ? 28 : 65);

    return () => clearTimeout(timer);
  }, [charPos, isDeletingChar, typeItemIdx, STORED_SEARCH_ITEMS]);


  // Load Customer & Real-time Listeners
  useEffect(() => {
    const raw = localStorage.getItem("auditx_customer") || localStorage.getItem("blinkit_customer");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.location = "KFGSC , Tiptur 572201";
        setCustomer(parsed);
      } catch (e) {
        console.warn(e);
      }
    }

    const rawOos = localStorage.getItem("auditx_oos_items");
    if (rawOos) {
      try {
        setOosList(JSON.parse(rawOos));
      } catch (e) {
        console.warn(e);
      }
    }

    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "ITEM_STOCK_TOGGLED" && data.payload) {
        if (!data.payload.inStock) {
          setOosList((prev) => [...new Set([...prev, data.payload.sku])]);
          triggerToast(`Stock Alert: "${data.payload.name}" marked Out of Stock by ASM Deepu B.`);
        } else {
          setOosList((prev) => prev.filter((s) => s !== data.payload.sku));
          triggerToast(`In Stock: "${data.payload.name}" is now available at Tiptur HUB!`);
        }
      }
    });

    const timer = setTimeout(() => setLoading(false), 200);
    return () => {
      clearTimeout(timer);
      unsubBus();
    };
  }, []);

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  }

  function updateQty(sku, delta) {
    const item = CATALOG.find((c) => c.sku === sku);
    if ((item?.soldOut || item?.inStock === false || (item?.name && item.name.toLowerCase().includes("pup"))) && delta > 0) {
      triggerToast(`⛔ "${item.name}" is Sold Out!`);
      return;
    }
    if (item?.comingSoon && delta > 0) {
      triggerToast(`${item.name} is coming soon to Tiptur Dark Store!`);
      return;
    }
    if (oosList.includes(sku) && delta > 0) {
      triggerToast("This item was marked Out of Stock by ASM Deepu B!");
      return;
    }

    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[sku] || 0) + delta;
      if (qty <= 0) delete next[sku];
      else next[sku] = qty;
      return next;
    });

    if (delta > 0 && item) {
      playSuccessChime();
    }
  }

  function toggleInstruction(id) {
    setSelectedInstructions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleApplyCoupon(coupon) {
    setAppliedCoupon(coupon);
    setShowCouponModal(false);
    playSuccessChime();
    triggerToast(`Coupon "${coupon.code}" applied! Savings calculated.`);
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    triggerToast("Coupon removed.");
  }

  // Cart Calculations
  const cartEntries = Object.entries(cart);
  const totalItems = cartEntries.reduce((s, [, q]) => s + q, 0);

  const cartItemsList = useMemo(() => {
    return cartEntries
      .map(([sku, qty]) => {
        const product = CATALOG.find((c) => c.sku === sku);
        if (!product) return null;
        return { ...product, qty };
      })
      .filter(Boolean);
  }, [cartEntries]);

  const itemTotalMrp = useMemo(() => {
    return cartItemsList.reduce((s, item) => s + (item.mrp || item.price) * item.qty, 0);
  }, [cartItemsList]);

  const itemSubtotal = useMemo(() => {
    return cartItemsList.reduce((s, item) => s + item.price * item.qty, 0);
  }, [cartItemsList]);

  const productDiscount = Math.max(0, itemTotalMrp - itemSubtotal);

  const isFreeDeliveryQualified = itemSubtotal >= FREE_DELIVERY_THRESHOLD || appliedCoupon?.freeDelivery;
  const deliveryFee = isFreeDeliveryQualified ? 0 : 25;
  const handlingFee = appliedCoupon?.freeHandling ? 0 : 4;

  let couponSavings = 0;
  if (appliedCoupon && itemSubtotal >= (appliedCoupon.minOrder || 0)) {
    if (appliedCoupon.flatDiscount) {
      couponSavings = appliedCoupon.flatDiscount;
    } else if (appliedCoupon.discountPct) {
      couponSavings = Math.min(
        appliedCoupon.maxDiscount || 50,
        Math.round((itemSubtotal * appliedCoupon.discountPct) / 100)
      );
    }
  }

  const grandTotal = Math.max(0, itemSubtotal - couponSavings + deliveryFee + handlingFee);
  const totalSavings = productDiscount + couponSavings + (itemSubtotal >= FREE_DELIVERY_THRESHOLD ? 25 : 0);

  // Upsell Recommendations ("Before you checkout")
  const upsellRecommendations = useMemo(() => {
    return CATALOG.filter((c) => !cart[c.sku] && !oosList.includes(c.sku) && !c.comingSoon).slice(0, 6);
  }, [cart, oosList]);

  // Categories & Filtering: Only Chocolates and Frames in active warehouse inventory
  const CATEGORY_DISPLAY = {
    "Chocolates": "🍫 Chocolates",
    "Frames": "🖼️ Wall Frames",
  };

  const categories = useMemo(() => {
    return ["Chocolates", "Frames"];
  }, []);

  const filteredCatalog = CATALOG.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aisle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Final Order Placement
  async function handleFinalOrderPlacement() {
    if (cartEntries.length === 0) {
      triggerToast("Your cart is empty. Add items from the catalog.");
      return;
    }

    setPlacingOrder(true);
    setShowPaymentModal(false);

    const orderId = `ORD-KA44-${Math.floor(100000 + Math.random() * 900000)}`;
    const rack = getRandomStagingRack();

    const createdOrder = {
      id: orderId,
      orderId,
      orderNumber: orderId,
      customerId: customer?.customerId || "cust_tiptur_demo",
      customerName: customer?.name || "Ramesh Gowda",
      customerPhone: customer?.phone || "9845112233",
      customerAddress: "KFGSC , Tiptur 572201",
      addressDetails: selectedAddress,
      deliveryInstructions: selectedInstructions.map(
        (id) => DELIVERY_INSTRUCTIONS_LIST.find((i) => i.id === id)?.label
      ),
      appliedCoupon: appliedCoupon?.code || null,
      couponSavings,
      totalAmount: grandTotal,
      itemTotal: itemSubtotal,
      deliveryFee,
      handlingFee,
      totalSavings,
      status: "pending",
      stage: "Awaiting OD Picker",
      assignedRack: rack.id,
      rackQr: rack.qr,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      paymentMethod:
        selectedPaymentMethod === "wallet"
          ? "AUDIT'X Express Wallet"
          : selectedPaymentMethod === "upi"
          ? `UPI Direct (${selectedUpiApp.toUpperCase()})`
          : selectedPaymentMethod === "card"
          ? "Saved Credit Card"
          : "Cash on Delivery",
      storeId: "TIPTUR-HUB-KA44",
      storeName: "Tiptur HUB - KA44",
      estimatedDeliveryMins: 8,
      createdAt: new Date().toISOString(),
      qrCode: `AUDITX-ORD-${orderId}-CUSTOMER-QR`,
      items: cartItemsList.map((item) => ({
        skuId: item.sku,
        name: item.name,
        qty: item.qty,
        binLocation: item.aisle || "F0 - A1 - 001",
        price: item.price,
        mrp: item.mrp || item.price,
        image: item.image,
      })),
    };

    // 1. Immediately persist & dispatch to Thrupthi K S and Sinchana B R (< 10ms)
    saveLiveOrder(createdOrder);
    try {
      localStorage.setItem("auditx_customer_last_order", JSON.stringify(createdOrder));
    } catch (e) {
      console.warn(e);
    }
    playNotificationChime();

    // 2. Update wallet locally
    if (selectedPaymentMethod === "wallet") {
      const updated = {
        ...customer,
        walletBalance: (customer?.walletBalance || WALLET_LIMIT) - grandTotal,
      };
      localStorage.setItem("auditx_customer", JSON.stringify(updated));
      localStorage.setItem("blinkit_customer", JSON.stringify(updated));
      setCustomer(updated);
    }

    triggerToast(`Order #${orderId} Placed Successfully! Delivery in 8 mins!`);

    // 3. Clear cart and redirect to live tracking screen
    setCart({});
    setTimeout(() => {
      router.push(`/track/${orderId}`);
    }, 400);
  }

  // Render Address Icon
  function renderAddressIcon(type) {
    if (type === "Work") return <IconBriefcase size={16} color="#0c831f" />;
    if (type === "Home") return <IconHome size={16} color="#0c831f" />;
    return <IconMapPin size={16} color="#0c831f" />;
  }

  // Render Instruction Icon
  function renderInstructionIcon(type, isSelected) {
    const col = isSelected ? "#0c831f" : "#475569";
    switch (type) {
      case "bell_off":
        return <IconBellOff size={16} color={col} />;
      case "door":
        return <IconDoor size={16} color={col} />;
      case "phone_off":
        return <IconPhoneOff size={16} color={col} />;
      case "mic":
        return <IconMic size={16} color={col} />;
      case "paw":
        return <IconPaw size={16} color={col} />;
      default:
        return <IconBellOff size={16} color={col} />;
    }
  }

  return (
    <div style={S.pageWrapper}>
      {toastMessage && (
        <div style={S.toast}>
          <IconCheck size={16} color="#ffffff" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Smartphone Device Shell Container (Dedicated Mobile Layout) */}
      <div style={S.mobileShell}>
        {/* ── 1. TOP HEADER (DELIVERY & ADDRESS BAR) ── */}
        <header style={S.topHeader}>
          <div style={S.headerContainer}>
            <div style={S.headerNavRow}>
              <div style={S.logoArea}>
                <AuditxLogo height={32} href="/" />
                <div style={S.brandTag}>
                  <span style={S.storeBadge}>Tiptur Hub KA - 44</span>
                </div>
              </div>

            <div style={S.headerActions}>
              {/* User Profile Button */}
              <button
                type="button"
                style={S.profileBtn}
                onClick={() => {
                  if (customer?.name) {
                    setShowProfileModal(true);
                  } else {
                    router.push("/ordering/login");
                  }
                }}
                title={customer?.name ? `Logged in: ${customer.name}` : "Click to Login / Register"}
              >
                <div style={S.profileAvatar}>
                  {customer?.name ? (
                    customer.name.charAt(0).toUpperCase()
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>
                <span style={S.profileBtnName}>
                  {customer?.name ? customer.name.split(" ")[0] : "Login"}
                </span>
              </button>

              <button
                style={S.viewToggleBtn}
                onClick={() => setIsCheckoutView(!isCheckoutView)}
                title="Toggle Catalog or Checkout Screen"
              >
                {isCheckoutView ? "Browse Catalog" : `Cart (${totalItems})`}
              </button>

            </div>
          </div>

          {/* Blinkit Delivery ETA & Address Selector Bar */}
          <div style={S.etaAddressBar} onClick={() => setShowAddressModal(true)}>
            <div style={S.etaAddressLeft}>
              <div style={S.etaBadgeRow}>
                <div style={S.lightningPill}>
                  <IconLightning size={14} color="#000000" />
                </div>
                <div style={S.etaTitle}>
                  Delivery in <span style={S.etaMinutes}>8 MINS</span>
                </div>
              </div>
              <div style={S.addressSnippetRow}>
                <IconMapPin size={14} color="#0c831f" />
                <span style={S.addressSnippetText}>KFGSC , Tiptur 572201</span>

                <IconChevronDown size={14} color="#475569" />
              </div>
            </div>

            <button
              type="button"
              style={S.changeAddressBtn}
              onClick={(e) => {
                e.stopPropagation();
                setShowAddressModal(true);
              }}
            >
              Change
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MAIN VIEW: EITHER DIRECT BLINKIT CHECKOUT SCREEN OR CATALOG
          ═══════════════════════════════════════════════════════════ */}
      {isCheckoutView ? (
        /* ── DEDICATED BLINKIT CART & CHECKOUT PAGE (EXACT ASCII WIREFRAME) ── */
        <main style={S.checkoutMain}>
          <div style={S.checkoutContainer}>
            {/* Navigation back bar */}
            <div style={S.checkoutNavBackRow}>
              <button
                style={S.backToCatalogBtn}
                onClick={() => setIsCheckoutView(false)}
              >
                <IconArrowLeft size={16} color="#0c831f" />
                <span>Add more items from Store</span>
              </button>
              <span style={S.cartCountHeader}>{totalItems} items in cart</span>
            </div>

            {/* 1. TOP DELIVERY & ADDRESS BAR (IN CHECKOUT) */}
            <div style={S.checkoutCard}>
              <div style={S.checkoutEtaHeader}>
                <div style={S.checkoutEtaLeft}>
                  <div style={S.checkoutEtaPill}>
                    <IconLightning size={16} color="#000000" />
                    <span style={S.checkoutEtaTime}>Delivery in 8 MINS</span>
                  </div>
                  <div style={S.checkoutAddressSub}>
                    <b>Fixed Delivery Point</b> — KFGSC , Tiptur 572201
                  </div>
                </div>
                <button
                  style={S.changeBtnSmall}
                  onClick={() => setShowAddressModal(true)}
                >
                  Change
                </button>
              </div>

              {/* Free delivery tracker */}
              <div style={S.freeDeliveryNotice}>
                <div style={S.freeDeliveryLabelRow}>
                  {isFreeDeliveryQualified ? (
                    <span style={S.unlockedFreeText}>
                      <IconCheck size={14} color="#0c831f" /> You have unlocked FREE Delivery!
                    </span>
                  ) : (
                    <span style={S.lockedFreeText}>
                      Add <b>₹{FREE_DELIVERY_THRESHOLD - itemSubtotal}</b> more for FREE Delivery!
                    </span>
                  )}
                  <span style={S.deliveryFeeBadge}>
                    {isFreeDeliveryQualified ? "FREE" : "₹25"}
                  </span>
                </div>
                <div style={S.progressTrack}>
                  <div
                    style={{
                      ...S.progressFill,
                      width: `${Math.min(100, (itemSubtotal / FREE_DELIVERY_THRESHOLD) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 2. CART ITEMS & QUANTITY CONTROLS (ITEMS ADDED) */}
            <section style={S.checkoutCard}>
              <div style={S.sectionHeaderRow}>
                <h3 style={S.cardSectionTitle}>ITEMS ADDED</h3>
                <span style={S.itemSubtextCount}>{totalItems} Items</span>
              </div>

              {cartItemsList.length === 0 ? (
                <div style={S.emptyCartState}>
                  <IconCartBag size={36} color="#94a3b8" />
                  <p style={S.emptyCartTitle}>Your cart is currently empty</p>
                  <button
                    style={S.browseCatalogBtn}
                    onClick={() => setIsCheckoutView(false)}
                  >
                    Browse Tiptur Catalog
                  </button>
                </div>
              ) : (
                <div style={S.itemsList}>
                  {cartItemsList.map((item) => {
                    const isOos = oosList.includes(item.sku);
                    return (
                      <div key={item.sku} style={S.itemCardRow}>
                        {/* Product Image */}
                        <div style={S.itemImgWrapper}>
                          <img
                            src={item.image}
                            alt={item.name}
                            style={S.itemThumbnail}
                          />
                          {isOos && (
                            <span style={S.itemOosOverlay}>Out of Stock</span>
                          )}
                        </div>

                        {/* Title & Weight */}
                        <div style={S.itemInfoCol}>
                          <h4 style={S.itemTitle}>{item.name}</h4>
                          <span style={S.itemWeight}>{item.weight}</span>
                          <div style={S.itemPriceRow}>
                            <span style={S.itemFinalPrice}>₹{item.price}</span>
                            {item.mrp > item.price && (
                              <span style={S.itemMrpStrike}>₹{item.mrp}</span>
                            )}

                          </div>
                        </div>

                        {/* Stepper / Counter Button directly on each item */}
                        <div style={S.stepperBox}>
                          <button
                            type="button"
                            style={S.stepperMinusBtn}
                            onClick={() => updateQty(item.sku, -1)}
                            title="Decrease quantity"
                          >
                            −
                          </button>
                          <span style={S.stepperQty}>{item.qty}</span>
                          <button
                            type="button"
                            style={S.stepperPlusBtn}
                            onClick={() => updateQty(item.sku, 1)}
                            disabled={isOos}
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>



            {/* 3. COUPON & DISCOUNT ENGINE (APPLY COUPON / VIEW OFFERS) */}
            <section style={S.checkoutCard}>
              <div
                style={S.couponWidget}
                onClick={() => setShowCouponModal(true)}
              >
                <div style={S.couponLeft}>
                  <div style={S.couponIconWrapper}>
                    <IconCoupon size={20} color="#0c831f" />
                  </div>
                  <div>
                    {appliedCoupon ? (
                      <div>
                        <div style={S.couponAppliedCode}>
                          Coupon <b>{appliedCoupon.code}</b> Applied
                        </div>
                        <div style={S.couponAppliedDesc}>
                          {appliedCoupon.label} — Saved ₹{couponSavings}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={S.couponPromptTitle}>Apply Coupon / View Offers</div>
                        <div style={S.couponPromptSub}>
                          Save up to ₹50 with promo codes & bank vouchers
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {appliedCoupon ? (
                  <button
                    type="button"
                    style={S.removeCouponBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCoupon();
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <div style={S.couponArrowRight}>
                    <IconArrowRight size={16} color="#0c831f" />
                  </div>
                )}
              </div>

              {/* Instant Savings Highlight */}
              {totalSavings > 0 && (
                <div style={S.savingsHighlightBanner}>
                  <IconCheck size={14} color="#0c831f" />
                  <span>
                    Instant Savings Applied: You saved <b>₹{totalSavings}</b> on this order!
                  </span>
                </div>
              )}
            </section>

            {/* 4. BILL & COST BREAKDOWN (BILL DETAILS) */}
            <section style={S.checkoutCard}>
              <div style={S.sectionHeaderRow}>
                <h3 style={S.cardSectionTitle}>BILL DETAILS</h3>
              </div>

              <div style={S.billBreakdown}>
                <div style={S.billRow}>
                  <span style={S.billLabel}>Item Total (MRP)</span>
                  <span style={S.billValue}>₹{itemTotalMrp}</span>
                </div>

                {productDiscount > 0 && (
                  <div style={S.billRow}>
                    <span style={S.billDiscountLabel}>Product Discount</span>
                    <span style={S.billDiscountValue}>− ₹{productDiscount}</span>
                  </div>
                )}

                {couponSavings > 0 && (
                  <div style={S.billRow}>
                    <span style={S.billDiscountLabel}>
                      Coupon Savings ({appliedCoupon.code})
                    </span>
                    <span style={S.billDiscountValue}>− ₹{couponSavings}</span>
                  </div>
                )}

                <div style={S.billRow}>
                  <span style={S.billLabel}>
                    Delivery Fee
                    {isFreeDeliveryQualified && (
                      <span style={S.freeDeliveryPill}>Free above ₹199</span>
                    )}
                  </span>
                  <span
                    style={
                      isFreeDeliveryQualified
                        ? S.billFreeHighlight
                        : S.billValue
                    }
                  >
                    {isFreeDeliveryQualified ? "FREE" : "₹25"}
                  </span>
                </div>

                <div style={S.billRow}>
                  <span style={S.billLabel}>Handling / Platform Fee</span>
                  <span style={S.billValue}>
                    {handlingFee === 0 ? "FREE" : `₹${handlingFee}`}
                  </span>
                </div>

                <div style={S.billDivider} />

                <div style={S.billGrandTotalRow}>
                  <div>
                    <span style={S.grandTotalLabel}>To Pay</span>
                    <div style={S.taxInclusiveSub}>
                      Incl. all dark store taxes & hub fees
                    </div>
                  </div>
                  <span style={S.grandTotalAmount}>₹{grandTotal}</span>
                </div>
              </div>
            </section>

            {/* 5. DELIVERY INSTRUCTIONS & PREFERENCES */}
            <section style={S.checkoutCard}>
              <div style={S.sectionHeaderRow}>
                <h3 style={S.cardSectionTitle}>DELIVERY INSTRUCTIONS</h3>
                <span style={S.instructionsSubtext}>Toggle for delivery partner</span>
              </div>

              <div style={S.instructionsGrid}>
                {DELIVERY_INSTRUCTIONS_LIST.map((ins) => {
                  const isSelected = selectedInstructions.includes(ins.id);
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      style={{
                        ...S.instructionChipBtn,
                        ...(isSelected ? S.instructionChipActive : {}),
                      }}
                      onClick={() => toggleInstruction(ins.id)}
                    >
                      <div style={S.chipIconWrapper}>
                        {renderInstructionIcon(ins.iconType, isSelected)}
                      </div>
                      <span style={S.chipLabel}>{ins.label}</span>
                      {isSelected && (
                        <div style={S.chipActiveCheck}>
                          <IconCheck size={12} color="#0c831f" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 10-Minute SLA Operations Guarantee */}
              <div style={S.darkStoreGuaranteeNote}>
                <IconShieldCheck size={18} color="#0c831f" />
                <div style={S.guaranteeTextCol}>
                  <span style={S.guaranteeTitle}>Tiptur HUB - KA44 Express Fulfillment</span>
                  <span style={S.guaranteeDesc}>
                    Express dark store order picking (2:00 min SLA) & doorstep delivery (8:00 min SLA) with OTP verification.
                  </span>
                </div>
              </div>
            </section>

            {/* Spacer for sticky bar */}
            <div style={{ height: 110 }} />
          </div>

          {/* ── 6. PAYMENT & CHECKOUT BAR (BOTTOM STICKY BAR) ── */}
          <div style={S.bottomStickyBar}>
            <div style={S.stickyBarInner}>
              <div style={S.stickyPriceCol}>
                <div style={S.stickyTotalRow}>
                  <span style={S.stickyTotalAmount}>₹{grandTotal}</span>
                  <span style={S.stickyTotalWord}>Total</span>
                </div>
                <div style={S.stickySavingsNote}>
                  {totalSavings > 0 ? `Saved ₹${totalSavings}` : "Safe & Contactless"}
                </div>
              </div>

              <button
                type="button"
                style={S.proceedToPayCTA}
                onClick={() => setShowPaymentModal(true)}
                disabled={placingOrder || cartItemsList.length === 0}
              >
                <span>{placingOrder ? "DISPATCHING..." : "PROCEED TO PAY"}</span>
                <IconArrowRight size={18} color="#ffffff" />
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ── CATALOG BROWSE VIEW (STORE WITH SMART CART BAR) ── */
        <main style={S.catalogMain}>
          <div style={S.catalogContainer}>
            {activeBottomTab === "home" && (
              <>
                {/* Search Bar */}
                <div style={S.searchContainer}>
              <div style={S.searchFieldWrapper}>
                <IconSearch size={18} color="#64748b" />
                <input
                  type="text"
                  placeholder={typewriterPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={S.searchInput}
                />
                {searchQuery && (
                  <button
                    type="button"
                    style={S.searchClearBtn}
                    onClick={() => setSearchQuery("")}
                  >
                    <IconClose size={16} color="#64748b" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Category Tabs: only Chocolates and Frames */}
            <div style={S.categoryTabsRow}>
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    style={{
                      ...S.categoryTabPill,
                      ...(active ? S.categoryTabActive : {}),
                    }}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {CATEGORY_DISPLAY[cat] || cat}
                  </button>
                );
              })}
            </div>

            {/* If anything except Frames and Chocolates is clicked, show the FULL PAGE Coming Soon Poster */}
            {selectedCategory !== "Chocolates" && selectedCategory !== "Frames" ? (
              <div style={S.fullPageComingSoonWrapper}>
                {/* Sticky Top Status Bar */}
                <div style={S.fullPageComingSoonTopBar}>
                  <div style={S.fullPageCatTag}>
                    <span style={S.fullPagePulseDot} />
                    <span>{selectedCategory} — Coming Soon</span>
                  </div>
                  <div style={S.fullPageShortcuts}>
                    <button
                      type="button"
                      style={S.quickTabChoc}
                      onClick={() => setSelectedCategory("Chocolates")}
                    >
                      🍫 Chocolates
                    </button>
                    <button
                      type="button"
                      style={S.quickTabFrame}
                      onClick={() => setSelectedCategory("Frames")}
                    >
                      🖼️ Wall Frames
                    </button>
                  </div>
                </div>

                {/* The Complete Full Page Image */}
                <div style={S.fullPageImageContainer}>
                  <img
                    src="/coming-soon.jpg"
                    alt="Coming Soon in Namma Tiptur KA 44 - AUDIT'X"
                    style={S.fullPageImg}
                  />
                </div>

                {/* Bottom Quick Return Shortcuts */}
                <div style={S.fullPageComingSoonBottomBar}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#14532d", marginBottom: 8 }}>
                    ⚡ Available In Dark Store Warehouse Now (10-Min Delivery):
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={S.fullPageBottomBtnChoc}
                      onClick={() => setSelectedCategory("Chocolates")}
                    >
                      🍫 Shop Chocolates (24 Items)
                    </button>
                    <button
                      type="button"
                      style={S.fullPageBottomBtnFrames}
                      onClick={() => setSelectedCategory("Frames")}
                    >
                      🖼️ Shop Wall Frames (35 Items)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Catalog Grid Header */}
                <div style={S.catalogGridHeader}>
                  <div>
                    <h2 style={S.catalogTitle}>
                      {CATEGORY_DISPLAY[selectedCategory] || selectedCategory}
                    </h2>
                    {selectedCategory === "Chocolates" && (
                      <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#0c831f", fontWeight: 700 }}>
                        🍫 Dark Store Warehouse Special: All 24 chocolate varieties in stock!
                      </p>
                    )}
                    {selectedCategory === "Frames" && (
                      <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#6366f1", fontWeight: 700 }}>
                        🖼️ Dark Store Warehouse Special: 35 Art & Heritage Glass Frames!
                      </p>
                    )}
                  </div>
                  <span style={S.catalogItemCount}>
                    {filteredCatalog.length} available items
                  </span>
                </div>

                {/* Product Cards Grid */}
                <div style={S.productGrid}>
                  {filteredCatalog.map((item) => {
                    const qty = cart[item.sku] || 0;
                    const isSoldOut = item.soldOut === true || item.inStock === false || (item.name && item.name.toLowerCase().includes("pup"));
                    const isOos = oosList.includes(item.sku) || isSoldOut;
                    const isChoc = item.category === "Chocolates";
                    const isFrame = item.category === "Frames";

                    return (
                      <div
                        key={item.sku}
                        style={{
                          ...S.productCard,
                          opacity: isSoldOut ? 0.72 : isOos ? 0.65 : 1,
                          ...(isSoldOut ? { border: "1.5px solid #fca5a5" } : {}),
                          ...(item.comingSoon ? { borderColor: "#fde68a" } : {}),
                        }}
                      >
                        <div style={S.productImageContainer}>
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={(e) => {
                              if (item.image && item.image.startsWith("/frames/")) {
                                const fb = `${JSDELIVR_PUBLIC_CDN}${item.image}`;
                                if (e.target.src !== fb) {
                                  e.target.src = fb;
                                }
                              }
                            }}
                            style={{
                              ...S.productImg,
                              ...(isSoldOut ? { filter: "grayscale(25%)" } : {}),
                            }}
                          />
                          {isSoldOut ? (
                            <div style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              background: "#dc2626",
                              color: "#ffffff",
                              fontSize: 9,
                              fontWeight: 900,
                              padding: "3px 7px",
                              borderRadius: 4,
                              letterSpacing: "0.04em",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              boxShadow: "0 2px 6px rgba(220,38,38,0.45)",
                              zIndex: 2,
                            }}>
                              <span>⛔ SOLD OUT</span>
                            </div>
                          ) : item.comingSoon ? (
                            <div style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              background: "linear-gradient(135deg, #f59e0b, #d97706)",
                              color: "#ffffff",
                              fontSize: 9,
                              fontWeight: 800,
                              padding: "3px 7px",
                              borderRadius: 4,
                              letterSpacing: "0.03em",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              boxShadow: "0 2px 4px rgba(217,119,6,0.3)"
                            }}>
                              <span>⏳ COMING SOON</span>
                            </div>
                          ) : isChoc ? (
                            <div style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              background: "#0c831f",
                              color: "#ffffff",
                              fontSize: 9,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              boxShadow: "0 2px 4px rgba(12,131,31,0.3)"
                            }}>
                              <span>₹1 WAREHOUSE</span>
                            </div>
                          ) : isFrame ? (
                            <div style={{
                              position: "absolute",
                              top: 6,
                              left: 6,
                              background: "#1e293b",
                              color: "#f8fafc",
                              fontSize: 9,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                            }}>
                              <span>🖼️ IN WAREHOUSE</span>
                            </div>
                          ) : (
                            <div style={S.etaBadgeOverlay}>
                              <IconLightning size={12} color="#000000" />
                              <span>8 MINS</span>
                            </div>
                          )}
                          {!isSoldOut && isOos && (
                            <div style={S.oosBadgeOverlay}>
                              <IconAlertTriangle size={12} color="#ffffff" />
                              <span>OUT OF STOCK</span>
                            </div>
                          )}
                        </div>

                        <div style={S.productDetailsCol}>

                          <h3 style={S.productName}>{item.name}</h3>
                          <div style={S.productWeight}>{item.weight}</div>

                          <div style={S.productActionRow}>
                            <div>
                              {item.comingSoon ? (
                                <span style={{ fontSize: 13, fontWeight: 800, color: "#d97706" }}>
                                  Coming Soon
                                </span>
                              ) : (
                                <>
                                  <span style={S.productFinalPrice}>₹{item.price}</span>
                                  {item.mrp > item.price && (
                                    <span style={S.productMrpStrike}>₹{item.mrp}</span>
                                  )}
                                </>
                              )}
                            </div>

                            {item.comingSoon ? (
                              <button
                                type="button"
                                style={{
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  color: "#b45309",
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                                onClick={() => setShowComingSoonModal(true)}
                              >
                                <span>Coming Soon ⏳</span>
                              </button>
                            ) : isSoldOut ? (
                              <button
                                type="button"
                                disabled
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fca5a5",
                                  color: "#dc2626",
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: "not-allowed",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                SOLD OUT
                              </button>
                            ) : isOos ? (
                              <button style={S.productOosBtn} disabled>
                                Unavailable
                              </button>
                            ) : qty === 0 ? (
                              <button
                                type="button"
                                style={S.productAddBtn}
                                onClick={() => updateQty(item.sku, 1)}
                              >
                                ADD
                              </button>
                            ) : (
                              <div style={S.productStepper}>
                                <button
                                  type="button"
                                  style={S.stepperSmallBtn}
                                  onClick={() => updateQty(item.sku, -1)}
                                >
                                  −
                                </button>
                                <span style={S.stepperSmallQty}>{qty}</span>
                                <button
                                  type="button"
                                  style={S.stepperSmallBtn}
                                  onClick={() => updateQty(item.sku, 1)}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB 2: ORDER AGAIN (EMPTY STATE)
            ══════════════════════════════════════════ */}
        {activeBottomTab === "order_again" && (
          <div style={S.tabViewContainer}>
            <div style={S.tabHeaderRow}>
              <div>
                <h2 style={S.tabTitle}>Order Again</h2>
                <p style={S.tabSubtitle}>Reorder your everyday dark store essentials</p>
              </div>
              <div style={S.reorderBadgePill}>
                <IconClock size={13} color="#0c831f" />
                <span>Fast 8-Min Reorder</span>
              </div>
            </div>

            {/* Clean, Elegant Empty State */}
            <div style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "48px 24px",
              textAlign: "center",
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}>
              <div style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                marginBottom: 4,
              }}>
                🛍️
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                No Past Orders Yet
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
                Your order history will appear here once you place your first order. You can easily reorder your favorite Chocolates & Frames with a single tap.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab("home");
                  setIsCheckoutView(false);
                }}
                style={{
                  marginTop: 8,
                  padding: "11px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0c831f",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(12, 131, 31, 0.28)",
                }}
              >
                <span>Start Shopping (Chocolates & Frames)</span>
                <IconArrowRight size={15} color="#ffffff" />
              </button>
            </div>
          </div>
        )}

                {/* ══════════════════════════════════════════
            TAB 3: CATEGORIES
            ══════════════════════════════════════════ */}
        {activeBottomTab === "categories" && (
          <div style={S.tabViewContainer}>
            <div style={S.tabHeaderRow}>
              <div>
                <h2 style={S.tabTitle}>All Categories</h2>
                <p style={S.tabSubtitle}>Active warehouse departments & upcoming items in Namma Tiptur</p>
              </div>
              <div style={S.reorderBadgePill}>
                <IconTag size={13} color="#0c831f" />
                <span>2 In Warehouse</span>
              </div>
            </div>

            {/* In-Warehouse Active Departments (Chocolates & Frames only) */}
            <div style={S.categoriesVerticalGrid}>
              {[
                {
                  name: "Chocolates",
                  tag: "In Warehouse",
                  desc: "Beatss, Melody, Kopiko, Boomer, Eclairs, Candyman & 24 varieties in warehouse",
                  zone: "Zone C2 • Aisle C2-A1",
                  count: "24 items",
                  bg: "#FEF3C7",
                  accent: "#92400E",
                },
                {
                  name: "Frames",
                  tag: "In Warehouse",
                  desc: "Kantara, D Boss, Yash KGF, Mahadev, Coding, Anime & 35 A4 Glass Frames",
                  zone: "Zone D3 • Aisle D3-A1",
                  count: "35 items",
                  bg: "#EDE9FE",
                  accent: "#6B21A8",
                },
              ].map((cat) => (
                <div
                  key={cat.name}
                  style={S.categoryDepartmentCard}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setActiveBottomTab("home");
                  }}
                >
                  <div style={S.categoryCardContent}>
                    <div style={S.catBadgeRow}>
                      <span style={{ ...S.catTagBadge, background: cat.bg, color: cat.accent }}>
                        {cat.tag}
                      </span>
                      <span style={S.catCountText}>{cat.count}</span>
                    </div>
                    <h3 style={S.catDepartmentTitle}>{cat.name}</h3>
                    <p style={S.catDepartmentDesc}>{cat.desc}</p>
                    <div style={S.catAisleZone}>
                      <IconMapPin size={11} color="#64748b" />
                      <span>{cat.zone}</span>
                    </div>
                  </div>
                  <div style={S.catArrowIcon}>
                    <IconArrowRight size={16} color="#0c831f" />
                  </div>
                </div>
              ))}
            </div>

            {/* Official Coming Soon Announcement Poster for all other categories */}
            <div style={{ marginTop: 20, width: "100%", textAlign: "center" }}>
              <div style={{
                background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
                borderRadius: 14,
                padding: "10px 14px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 4px 12px rgba(6, 78, 59, 0.25)"
              }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#a7f3d0", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em" }}>
                    NAMMA TIPTUR KA 44
                  </div>
                  <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 900, marginTop: 1 }}>
                    Groceries Coming Soon
                  </div>
                </div>
                <span style={{
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                }}>
                  SLA PREP
                </span>
              </div>

              {/* Full Coming Soon Poster Image */}
              <div
                style={{
                  width: "100%",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  border: "2px solid #86efac",
                  background: "#080c14",
                  cursor: "pointer",
                }}
                onClick={() => setShowComingSoonModal(true)}
              >
                <img
                  src="/coming-soon.jpg"
                  alt="Coming Soon in Namma Tiptur KA 44"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB 4: EXPLORE NAMMA TIPTUR (ನಮ್ಮ ತಿಪಟೂರು)
            ══════════════════════════════════════════ */}
        {activeBottomTab === "explore_tiptur" && (
          <div style={S.tabViewContainer}>
            {/* ── CINEMATIC MERGED BACKGROUND VIDEO HERO (v1.mp4 -> v2.mp4) ── */}
            <div style={S.tipturHeroVideoBanner}>
              {/* Merged Background Video Element (Sound OFF permanently) */}
              <video
                key={bgVideoIdx}
                ref={(el) => {
                  if (el) {
                    el.muted = true;
                    el.defaultMuted = true;
                    el.play().catch(() => {});
                  }
                }}
                src={MERGED_BACKGROUND_VIDEOS[bgVideoIdx].src}
                autoPlay
                muted
                playsInline
                preload="auto"
                style={S.mergedBgVideoElement}
                onError={(e) => {
                  const fb = MERGED_BACKGROUND_VIDEOS[bgVideoIdx]?.fallback;
                  if (fb && e.target.src !== fb) {
                    e.target.src = fb;
                    e.target.play().catch(() => {});
                  }
                }}
                onTimeUpdate={(e) => {
                  const limit = MERGED_BACKGROUND_VIDEOS[bgVideoIdx].durationLimit;
                  if (limit && e.target.currentTime >= limit) {
                    setBgVideoIdx((prev) => (prev + 1) % MERGED_BACKGROUND_VIDEOS.length);
                  }
                }}
                onEnded={() => {
                  setBgVideoIdx((prev) => (prev + 1) % MERGED_BACKGROUND_VIDEOS.length);
                }}
              />

              {/* Clean Video Overlay: Only Title Appears Directly Over Video (No Black Box) */}
              <div style={S.tipturHeroOverlay}>
                <h2 style={S.heroBannerTitle}>
                  ನಮ್ಮ ತಿಪಟೂರು • ತೆಂಗಿನ ನಗರ • NAMMA TIPTUR 🥥
                </h2>
              </div>
            </div>

            {/* ── 1. ABOUT TIPTUR GANESHA ── */}
            <div style={S.ganeshaCard}>
              <div style={S.ganeshaHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img
                    src="/images/sri-sathya-ganapathi-logo.jpg"
                    alt="Sri Sathya Ganapathi Seva Sangha Tiptur Emblem"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid #f59e0b",
                      boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={S.ganeshaTitleArea}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={S.ganeshaHeritagePill}>{TIPTUR_GANESHA_INFO.yearsBadge}</span>
                    </div>
                    <h3 style={S.ganeshaMainTitle}>
                      {ganeshaLang === "kannada"
                        ? "ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ ಸೇವಾ ಸಂಘ (ರಿ.) — ತಿಪಟೂರು ಜಾತ್ರೆ"
                        : ganeshaLang === "hindi"
                        ? "श्री सत्य गणपति सेवा संघ (रजि.) तिप्तूर उत्सव"
                        : "The Tiptur Ganesha Utsava • Sri Sathya Ganapathi Jatre"}
                    </h3>
                    <div style={S.ganeshaSubTitle}>
                      {ganeshaLang === "kannada"
                        ? "೯೬+ ವರ್ಷಗಳ ಐತಿಹಾಸಿಕ ಸಾಂಸ್ಕೃತಿಕ ಪರಂಪರೆ ಹಾಗೂ ಆಸ್ಥಾನ ಮಂಟಪ"
                        : ganeshaLang === "hindi"
                        ? "96+ वर्षों की ऐतिहासिक सांस्कृतिक परंपरा एवं भव्य महा महोत्सव"
                        : "Sri Sathya Ganapathi Seva Sangha (Regd.) Tiptur • 96+ Years Cultural Heritage"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Language Selector (Globe icon & 3-language dropdown) */}
              <div style={S.ganeshaLangRow}>
                <div style={S.ganeshaDropdownWrap}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <select
                    id="ganesha-lang-select"
                    value={ganeshaLang}
                    onChange={(e) => setGaneshaLang(e.target.value)}
                    style={S.ganeshaSelectDropdown}
                    aria-label="Select language"
                  >
                    <option value="english">English</option>
                    <option value="kannada">ಕನ್ನಡ</option>
                    <option value="hindi">हिंदी</option>
                  </select>
                </div>
              </div>

              {/* Authentic Historic Ganesha Image - Fully Clear Frame (100% visible, uncropped) */}
              {TIPTUR_GANESHA_INFO.image && (
                <div style={S.ganeshaImageCard}>
                  <img
                    src={TIPTUR_GANESHA_INFO.image}
                    alt="Tiptur Sri Sathya Ganapathi Idol"
                    style={S.ganeshaHeroImage}
                  />
                  <div style={S.ganeshaFrameCaption}>
                    🕉️ ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ • Sri Sathya Ganapathi Historic Idol (Since 1929)
                  </div>
                </div>
              )}

              <div style={S.ganeshaStoryCol}>
                {/* Kannada Section */}
                {ganeshaLang === "kannada" && (
                  <div style={S.ganeshaSectionBlock}>
                    <div style={S.ganeshaLangHeaderBadge}>
                      <span>🌺</span>
                      <span>ಶ್ರೀ ಸತ್ಯ ಗಣಪತಿ ಜಾತ್ರೆ • ಐತಿಹಾಸಿಕ ಹಿನ್ನೆಲೆ</span>
                    </div>
                    {TIPTUR_GANESHA_INFO.kannadaStory.map((para, idx) => (
                      <p key={idx} style={S.ganeshaPara}>
                        {para}
                      </p>
                    ))}
                  </div>
                )}

                {/* Hindi Section */}
                {ganeshaLang === "hindi" && (
                  <div style={S.ganeshaSectionBlock}>
                    <div style={S.ganeshaLangHeaderBadge}>
                      <span>🪔</span>
                      <span>श्री सत्य गणपति जात्रा • ऐतिहासिक धरोहर</span>
                    </div>
                    {TIPTUR_GANESHA_INFO.hindiStory.map((para, idx) => (
                      <p key={idx} style={S.ganeshaPara}>
                        {para}
                      </p>
                    ))}
                  </div>
                )}

                {/* English Section */}
                {ganeshaLang === "english" && (
                  <div style={S.ganeshaSectionBlock}>
                    <div style={S.ganeshaLangHeaderBadge}>
                      <span>🚩</span>
                      <span>Historical Heritage and Procession</span>
                    </div>
                    {TIPTUR_GANESHA_INFO.englishStory.map((para, idx) => (
                      <p key={idx} style={S.ganeshaPara}>
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Highlights Grid */}
              <div style={S.ganeshaStatsGrid}>
                {TIPTUR_GANESHA_INFO.stats.map((st, i) => (
                  <div key={i} style={S.ganeshaStatCard}>
                    <div style={S.ganeshaStatLabel}>{st.label}</div>
                    <div style={S.ganeshaStatVal}>
                      {ganeshaLang === "kannada"
                        ? st.knVal
                        : ganeshaLang === "hindi"
                        ? st.hiVal
                        : st.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 2. POPULAR RESTAURANTS & FINE DINING ── */}
            <div style={S.placesSection}>
              <div style={S.sectionHeadingRow}>
                <div>
                  <h3 style={S.sectionSubTitle}>Popular Restaurants & Fine Dining</h3>
                </div>
                <span style={S.sectionSubCount}>{TIPTUR_RESTAURANTS.length} Places</span>
              </div>

              <div style={S.placesListCol}>
                {TIPTUR_RESTAURANTS.map((rest) => (
                  <div key={rest.name} style={S.placeCard}>
                    {rest.image && (
                      <div style={S.restImageWrap}>
                        <img
                          src={rest.image}
                          alt=""
                          style={{
                            ...S.restThumbImg,
                            objectPosition: rest.imagePos || "center center",
                          }}
                        />
                      </div>
                    )}
                    <div style={S.placeTopRow}>
                      <div style={S.placeTitleRow}>
                        <h4 style={S.placeMainName}>{rest.name}</h4>
                      </div>
                      <span
                        style={{
                          ...S.placeBadge,
                          background: rest.bg,
                          color: rest.color,
                        }}
                      >
                        {rest.type}
                      </span>
                    </div>
                    <div style={S.placeFooter}>
                      <span style={S.placeLocText}>
                        <IconMapPin size={11} color="#64748b" />
                        <span>{rest.loc}</span>
                      </span>
                      <span style={S.placeRatingTag}>★ {rest.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 3. TRENDING CAFES ── */}
            <div style={S.placesSection}>
              <div style={S.sectionHeadingRow}>
                <div>
                  <h3 style={S.sectionSubTitle}>Trending Cafes</h3>
                </div>
                <span style={S.sectionSubCount}>{TIPTUR_CAFES.length} Cafes</span>
              </div>

              <div style={S.cafesGrid}>
                {TIPTUR_CAFES.map((cafe) => (
                  <div key={cafe.name} style={S.cafeCard}>
                    {cafe.image && (
                      <div style={S.cafeImageWrap}>
                        <img
                          src={cafe.image}
                          alt=""
                          style={{
                            ...S.cafeThumbImg,
                            objectPosition: cafe.imagePos || "center center",
                          }}
                        />
                      </div>
                    )}
                    <div style={S.cafeBody}>
                      <div style={S.cafeTop}>
                        <h4 style={S.cafeName} title={cafe.name}>{cafe.name}</h4>
                        <span style={S.cafeRating}>★ {cafe.rating}</span>
                      </div>
                    </div>
                    <div style={S.cafeBottom}>
                      <span
                        style={{
                          ...S.cafeTypePill,
                          background: cafe.bg,
                          color: cafe.color,
                        }}
                      >
                        {cafe.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 4. FARMS: AKSHAYAKALPA ORGANIC FARM ── */}
            <div style={S.placesSection}>
              <div style={S.sectionHeadingRow}>
                <div>
                  <h3 style={S.sectionSubTitle}>Farms</h3>
                </div>
                <span style={S.sectionSubCount}>Eco Agro-Farm</span>
              </div>

              {TIPTUR_FARMS.map((farm) => (
                <div key={farm.name} style={S.farmCard}>
                  <div style={S.farmHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img
                        src="/images/akshayakalpa-logo.jpg"
                        alt="Akshayakalpa Organic Logo"
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          objectFit: "contain",
                          background: "#ffffff",
                          padding: 2,
                          border: "2px solid #86efac",
                          boxShadow: "0 2px 8px rgba(12, 131, 31, 0.15)",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <h4 style={S.farmTitle}>{farm.name}</h4>

                      </div>
                    </div>
                    <span style={S.farmBadge}>{farm.badge}</span>
                  </div>
                  <p style={S.farmDesc}>{farm.desc}</p>

                  {/* Akshayakalpa Agro-Ecological Drone Tour Video (AK.mp4 - trimmed to 45s, stops at 45s, sound off permanently) */}
                  {farm.video && (
                    <div style={S.farmVideoBox}>
                      <video
                        ref={(el) => {
                          if (el) {
                            el.muted = true;
                            el.defaultMuted = true;
                            el.play().catch(() => {});
                          }
                        }}
                        src={farm.video}
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        controls
                        style={S.farmVideoPlayer}
                        onError={(e) => {
                          const fb = `${JSDELIVR_PUBLIC_CDN}/videos/AK.mp4`;
                          if (e.target.src !== fb) {
                            e.target.src = fb;
                            e.target.play().catch(() => {});
                          }
                        }}
                        onTimeUpdate={(e) => {
                          if (e.target.currentTime >= 45) {
                            e.target.pause();
                            e.target.currentTime = 45;
                          }
                        }}
                        onEnded={(e) => {
                          e.target.pause();
                        }}
                      />
                    </div>
                  )}

                  <div style={S.farmHighlightsGrid}>
                    {farm.highlights.map((h, i) => (
                      <div key={i} style={S.farmChip}>
                        <IconCheck size={12} color="#166534" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>

                  <div style={S.farmFooter}>
                    <IconMapPin size={12} color="#15803d" />
                    <span>{farm.loc}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, color: "#15803d" }}>
                      {farm.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── 5. OPERATIONS & DARK STORE HUB HIGHLIGHTS ── */}
            <div style={{ marginTop: 10 }}>
              <div style={S.sectionHeadingRow}>
                <h3 style={S.sectionSubTitle}>Tiptur Hub KA44 Fulfillment</h3>
                <span style={S.sectionSubCount}>Dark Store SLA</span>
              </div>
              <div style={S.tipturHighlightsGrid}>
                <div style={S.tipturHighlightCard}>
                  <div style={S.highlightIconWrapper}>
                    <IconShieldCheck size={18} color="#0c831f" />
                  </div>
                  <div>
                    <h4 style={S.highlightTitle}>APMC Yard Procurement</h4>
                    <p style={S.highlightDesc}>
                      Procured daily from APMC Coconut Market on B.H. Road, graded by ASM Deepu B.
                    </p>
                  </div>
                </div>

                <div style={S.tipturHighlightCard}>
                  <div style={S.highlightIconWrapper}>
                    <IconLightning size={18} color="#d97706" />
                  </div>
                  <div>
                    <h4 style={S.highlightTitle}>8 Minute Dark Store SLA</h4>
                    <p style={S.highlightDesc}>
                      Near Kalpataru College Road, delivering across Tiptur town in fractions of minutes.
                    </p>
                  </div>
                </div>

                <div style={S.tipturHighlightCard}>
                  <div style={S.highlightIconWrapper}>
                    <IconMapPin size={18} color="#2563eb" />
                  </div>
                  <div>
                    <h4 style={S.highlightTitle}>KA44 Dark Store Hub</h4>
                    <p style={S.highlightDesc}>
                      Tiptur Express Fulfillment Center • 8-Minute Instant Delivery Network
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

            {/* Floating Quick Cart Bar (Visible only when user clicks and adds items) */}
            {totalItems > 0 && activeBottomTab !== "explore_tiptur" && (
              <div style={S.catalogFloatingCartBar}>
                <div style={S.floatingCartInner}>
                  <div style={S.floatingCartLeft}>
                    <div style={S.floatingBagPill}>
                      <IconCartBag size={18} color="#ffffff" />
                    </div>
                    <div>
                      <div style={S.floatingCartCount}>
                        {totalItems} {totalItems === 1 ? "ITEM" : "ITEMS"} • ₹{grandTotal}
                      </div>
                      <div style={S.floatingSavings}>
                        Delivery in 8 mins to {selectedAddress.type}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={S.floatingViewCartCTA}
                    onClick={() => setIsCheckoutView(true)}
                  >
                    <span>View Cart & Checkout</span>
                    <IconArrowRight size={16} color="#ffffff" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── AUTHENTIC MOBILE BOTTOM NAVIGATION BAR (Home, Order Again, Categories, Explore Namma Tiptur) ── */}
      <nav style={S.bottomNavBar}>
        {/* Tab 1: Home */}
        <button
          id="tab-home"
          type="button"
          style={{
            ...S.bottomNavTabBtn,
            ...(activeBottomTab === "home" && !isCheckoutView ? S.bottomNavTabActive : {}),
          }}
          onClick={() => {
            setActiveBottomTab("home");
            setIsCheckoutView(false);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={activeBottomTab === "home" && !isCheckoutView ? "#0C831F" : "none"} stroke={activeBottomTab === "home" && !isCheckoutView ? "#0C831F" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={{
            ...S.bottomNavLabel,
            ...(activeBottomTab === "home" && !isCheckoutView ? S.bottomNavLabelActive : {}),
          }}>
            Home
          </span>
        </button>

        {/* Tab 2: Order Again */}
        <button
          id="tab-order-again"
          type="button"
          style={{
            ...S.bottomNavTabBtn,
            ...(activeBottomTab === "order_again" && !isCheckoutView ? S.bottomNavTabActive : {}),
          }}
          onClick={() => {
            setActiveBottomTab("order_again");
            setIsCheckoutView(false);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeBottomTab === "order_again" && !isCheckoutView ? "#0C831F" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          <span style={{
            ...S.bottomNavLabel,
            ...(activeBottomTab === "order_again" && !isCheckoutView ? S.bottomNavLabelActive : {}),
          }}>
            Order Again
          </span>
        </button>

        {/* Tab 3: Categories */}
        <button
          id="tab-categories"
          type="button"
          style={{
            ...S.bottomNavTabBtn,
            ...(activeBottomTab === "categories" && !isCheckoutView ? S.bottomNavTabActive : {}),
          }}
          onClick={() => {
            setActiveBottomTab("categories");
            setIsCheckoutView(false);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeBottomTab === "categories" && !isCheckoutView ? "#0C831F" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span style={{
            ...S.bottomNavLabel,
            ...(activeBottomTab === "categories" && !isCheckoutView ? S.bottomNavLabelActive : {}),
          }}>
            Categories
          </span>
        </button>

        {/* Tab 4: Explore Namma Tiptur */}
        <button
          id="tab-explore-tiptur"
          type="button"
          style={{
            ...S.bottomNavTabBtn,
            ...(activeBottomTab === "explore_tiptur" && !isCheckoutView ? S.bottomNavTabActive : {}),
          }}
          onClick={() => {
            setActiveBottomTab("explore_tiptur");
            setIsCheckoutView(false);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeBottomTab === "explore_tiptur" && !isCheckoutView ? "#0C831F" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={activeBottomTab === "explore_tiptur" && !isCheckoutView ? "#0C831F" : "none"} />
          </svg>
          <span style={{
            ...S.bottomNavLabel,
            ...(activeBottomTab === "explore_tiptur" && !isCheckoutView ? S.bottomNavLabelActive : {}),
          }}>
            Explore Namma Tiptur
          </span>
        </button>
      </nav>
      </div> {/* end mobileShell */}

      {/* ═══════════════════════════════════════════════════════════
          6. PAYMENT GATEWAY SELECTION MODAL
          ═══════════════════════════════════════════════════════════ */}
      {showPaymentModal && (
        <div
          style={S.modalBackdrop}
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            style={S.paymentModalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>Select Payment Method</h3>
                <div style={S.modalSubtitle}>
                  Amount Payable: <b style={{ color: "#0c831f" }}>₹{grandTotal}</b>
                </div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowPaymentModal(false)}
              >
                <IconClose size={20} color="#64748b" />
              </button>
            </div>

            <div style={S.paymentOptionsList}>
              {/* Option 1: UPI Direct */}
              <div
                style={{
                  ...S.paymentCardOption,
                  ...(selectedPaymentMethod === "upi"
                    ? S.paymentCardOptionActive
                    : {}),
                }}
                onClick={() => setSelectedPaymentMethod("upi")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconUpi size={20} color="#0c831f" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>UPI Direct (1-Tap Fast Checkout)</div>
                    <div style={S.paymentMethodSub}>
                      Google Pay, PhonePe, Paytm, CRED UPI
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={selectedPaymentMethod === "upi"}
                  onChange={() => setSelectedPaymentMethod("upi")}
                  style={S.radioBtn}
                />
              </div>

              {selectedPaymentMethod === "upi" && (
                <div style={S.upiAppsGrid}>
                  {[
                    { id: "gpay", label: "Google Pay" },
                    { id: "phonepe", label: "PhonePe" },
                    { id: "paytm", label: "Paytm UPI" },
                    { id: "cred", label: "CRED UPI" },
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      style={{
                        ...S.upiAppBtn,
                        ...(selectedUpiApp === app.id ? S.upiAppBtnActive : {}),
                      }}
                      onClick={() => setSelectedUpiApp(app.id)}
                    >
                      <IconCheck
                        size={14}
                        color={selectedUpiApp === app.id ? "#0c831f" : "#cbd5e1"}
                      />
                      <span>{app.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Option 2: Express Ops Wallet */}
              <div
                style={{
                  ...S.paymentCardOption,
                  ...(selectedPaymentMethod === "wallet"
                    ? S.paymentCardOptionActive
                    : {}),
                }}
                onClick={() => setSelectedPaymentMethod("wallet")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconWallet size={20} color="#0c831f" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>AUDIT'X Express Wallet</div>
                    <div style={S.paymentMethodSub}>
                      Available Balance: ₹
                      {(customer?.walletBalance || WALLET_LIMIT).toLocaleString(
                        "en-IN"
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={selectedPaymentMethod === "wallet"}
                  onChange={() => setSelectedPaymentMethod("wallet")}
                  style={S.radioBtn}
                />
              </div>

              {/* Option 3: Credit / Debit Card & Net Banking */}
              <div
                style={{
                  ...S.paymentCardOption,
                  ...(selectedPaymentMethod === "card"
                    ? S.paymentCardOptionActive
                    : {}),
                }}
                onClick={() => setSelectedPaymentMethod("card")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconCreditCard size={20} color="#0c831f" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>Saved Credit / Debit Cards</div>
                    <div style={S.paymentMethodSub}>
                      Visa, MasterCard, RuPay (CVV 843)
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={selectedPaymentMethod === "card"}
                  onChange={() => setSelectedPaymentMethod("card")}
                  style={S.radioBtn}
                />
              </div>

              {/* Option 4: Cash on Delivery (COD) */}
              <div
                style={{
                  ...S.paymentCardOption,
                  ...(selectedPaymentMethod === "cod"
                    ? S.paymentCardOptionActive
                    : {}),
                }}
                onClick={() => setSelectedPaymentMethod("cod")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconCash size={20} color="#0c831f" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>Cash on Delivery (COD)</div>
                    <div style={S.paymentMethodSub}>
                      Pay cash or scan QR upon arrival in Tiptur Hub KA - 44
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={selectedPaymentMethod === "cod"}
                  onChange={() => setSelectedPaymentMethod("cod")}
                  style={S.radioBtn}
                />
              </div>
            </div>

            <div style={S.modalFooterCTA}>
              <button
                type="button"
                style={S.confirmPayBtn}
                onClick={handleFinalOrderPlacement}
                disabled={placingOrder}
              >
                <span>
                  {placingOrder
                    ? "Dispatching to OD Picker..."
                    : `Pay ₹${grandTotal} & Place Order`}
                </span>
                <IconArrowRight size={18} color="#ffffff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CUSTOMER PROFILE DRAWER / MODAL
          ═══════════════════════════════════════════════════════════ */}
      {showProfileModal && (
        <div style={S.modalBackdrop} onClick={() => setShowProfileModal(false)}>
          <div style={S.profileModalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>Customer Account</h3>
                <div style={S.modalSubtitle}>AUDIT'X Dark Store • Tiptur HUB KA44</div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowProfileModal(false)}
              >
                <IconClose size={20} color="#64748b" />
              </button>
            </div>

            {/* Profile Hero Card */}
            <div style={S.profileHeroCard}>
              <div style={S.profileHeroAvatar}>
                {customer?.name ? customer.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={S.profileHeroInfo}>
                <div style={S.profileHeroName}>{customer?.name || "Customer"}</div>
                <div style={S.profileHeroPhone}>+91 {customer?.phone || "9845112233"}</div>
                <div style={S.profileHeroBadge}>
                  <span>Verified Dark Store Customer</span>
                </div>
              </div>
            </div>

            {/* Delivery Location Display */}
            <div style={S.profileSectionBox}>
              <div style={S.profileSectionHeading}>
                <IconMapPin size={14} color="#0c831f" />
                <span>Delivery Location</span>

              </div>
              <div style={S.profileAddressText}>
                <b style={{ color: "#0f172a" }}>KFGSC Campus Hub</b>
                <p style={{ margin: "3px 0 0", color: "#475569", fontSize: 13, fontWeight: 700 }}>
                  KFGSC , Tiptur 572201
                </p>
                <p style={{ margin: "5px 0 0", color: "#0c831f", fontSize: 11, fontWeight: 700 }}>
                  ⚡ Guaranteed 8-10 minute express dark store delivery point
                </p>
              </div>
            </div>

            {/* Wallet & Quick Stats */}
            <div style={S.profileStatsRow}>
              <div style={S.profileStatCol}>
                <span style={S.statLabel}>Express Wallet</span>
                <span style={S.statValue}>₹{(customer?.walletBalance || 999850).toLocaleString("en-IN")}</span>
              </div>
              <div style={S.profileStatCol}>
                <span style={S.statLabel}>Active Hub</span>
                <span style={S.statValue}>Tiptur KA-44</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={S.profileActionsCol}>
              <button
                type="button"
                style={S.profileEditBtn}
                onClick={() => {
                  setLoginName(customer?.name || "");
                  setLoginPhone(customer?.phone || "");
                  setLoginStep("phone");
                  setShowProfileModal(false);
                  setShowLoginModal(true);
                }}
              >
                <span>Edit Account (Name / Phone Number)</span>
                <IconArrowRight size={14} color="#0c831f" />
              </button>

              <button
                type="button"
                style={S.profileDedicatedPageBtn}
                onClick={() => {
                  setShowProfileModal(false);
                  router.push("/ordering/login");
                }}
              >
                <span>Open Dedicated Login Page</span>
                <IconArrowRight size={14} color="#334155" />
              </button>

              <button
                type="button"
                style={S.profileLogoutBtn}
                onClick={() => {
                  localStorage.removeItem("auditx_customer");
                  localStorage.removeItem("blinkit_customer");
                  setCustomer(null);
                  setShowProfileModal(false);
                  triggerToast("Logged out successfully.");
                  setLoginStep("phone");
                  setShowLoginModal(true);
                }}
              >
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CUSTOMER LOGIN MODAL (PHONE -> OTP -> NAME)
          ═══════════════════════════════════════════════════════════ */}
      {showLoginModal && (
        <div style={S.modalBackdrop} onClick={() => setShowLoginModal(false)}>
          <div style={S.loginModalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>
                  {loginStep === "phone" && "Customer Login"}
                  {loginStep === "otp" && "Verify OTP"}
                  {loginStep === "name" && "Enter Your Name"}
                </h3>
                <div style={S.modalSubtitle}>AUDIT'X Dark Store • KFGSC Tiptur 572201</div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowLoginModal(false)}
              >
                <IconClose size={20} color="#64748b" />
              </button>
            </div>

            {loginError && (
              <div style={S.loginErrorBanner}>{loginError}</div>
            )}

            {/* STEP 1: PHONE NUMBER */}
            {loginStep === "phone" && (
              <div>
                <p style={S.loginPromptText}>
                  Enter your 10-digit mobile number to login or register
                </p>
                <div style={S.loginPhoneInputWrapper}>
                  <span style={S.loginCountryCode}>🇮🇳 +91</span>
                  <input
                    type="tel"
                    placeholder="Enter mobile number"
                    maxLength={10}
                    value={loginPhone}
                    onChange={(e) => {
                      setLoginPhone(e.target.value.replace(/\D/g, ""));
                      setLoginError("");
                    }}
                    style={S.loginPhoneInput}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  style={S.loginSubmitBtn}
                  disabled={loginLoading || loginPhone.length !== 10}
                  onClick={() => {
                    if (loginPhone.length !== 10) {
                      setLoginError("Please enter a valid 10-digit Indian mobile number");
                      return;
                    }
                    setLoginLoading(true);
                    const mock = Math.floor(100000 + Math.random() * 900000).toString();
                    setLoginDemoOtp(mock);
                    setTimeout(() => {
                      setLoginLoading(false);
                      setLoginStep("otp");
                    }, 350);
                  }}
                >
                  {loginLoading ? "Sending Code..." : "Continue with OTP"}
                  <IconArrowRight size={16} color="#ffffff" />
                </button>
              </div>
            )}

            {/* STEP 2: OTP VERIFICATION */}
            {loginStep === "otp" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                    onClick={() => setLoginStep("phone")}
                  >
                    ← Edit +91 {loginPhone}
                  </button>
                </div>
                <p style={S.loginPromptText}>
                  Enter the 6-digit verification code sent to your phone
                </p>
                <div style={S.demoOtpBanner}>
                  <span>⚡ Demo OTP: <b>{loginDemoOtp}</b></span>
                  <button
                    type="button"
                    style={S.autoFillBtnSmall}
                    onClick={() => setLoginOtp(loginDemoOtp)}
                  >
                    Auto-fill
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => {
                    setLoginOtp(e.target.value.replace(/\D/g, ""));
                    setLoginError("");
                  }}
                  style={S.loginOtpInput}
                  autoFocus
                />
                <button
                  type="button"
                  style={S.loginSubmitBtn}
                  disabled={loginLoading || loginOtp.length < 4}
                  onClick={() => {
                    if (loginOtp.length < 4) {
                      setLoginError("Please enter the verification code");
                      return;
                    }
                    setLoginLoading(true);
                    setTimeout(() => {
                      setLoginLoading(false);
                      setLoginStep("name");
                    }, 350);
                  }}
                >
                  {loginLoading ? "Verifying..." : "Verify & Continue"}
                  <IconArrowRight size={16} color="#ffffff" />
                </button>
              </div>
            )}

            {/* STEP 3: CUSTOMER NAME */}
            {loginStep === "name" && (
              <div>
                <p style={S.loginPromptText}>
                  What should we call you? Please enter your full name:
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Gowda / Deepu B"
                    value={loginName}
                    onChange={(e) => {
                      setLoginName(e.target.value);
                      setLoginError("");
                    }}
                    style={S.loginNameInput}
                    autoFocus
                  />
                </div>

                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: "1px solid #e2e8f0", fontSize: 12 }}>
                  <div style={{ color: "#64748b" }}>Fixed Location: <b style={{ color: "#0f172a" }}>KFGSC , Tiptur 572201</b></div>
                </div>

                <button
                  type="button"
                  style={S.loginSubmitBtn}
                  disabled={loginLoading || !loginName.trim()}
                  onClick={() => {
                    if (!loginName.trim()) {
                      setLoginError("Please enter your name");
                      return;
                    }
                    const custObj = {
                      customerId: `cust_${loginPhone}`,
                      name: loginName.trim(),
                      phone: loginPhone,
                      location: "KFGSC , Tiptur 572201",
                      walletBalance: customer?.walletBalance || 999850,
                    };
                    localStorage.setItem("auditx_customer", JSON.stringify(custObj));
                    localStorage.setItem("blinkit_customer", JSON.stringify(custObj));
                    setCustomer(custObj);
                    setShowLoginModal(false);
                    triggerToast(`Welcome, ${loginName.trim()}! Profile saved.`);
                  }}
                >
                  <span>Save & Complete Profile</span>
                  <IconCheck size={16} color="#ffffff" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ADDRESS SELECTOR / SWITCHER MODAL
          ═══════════════════════════════════════════════════════════ */}
      {showAddressModal && (
        <div
          style={S.modalBackdrop}
          onClick={() => setShowAddressModal(false)}
        >
          <div
            style={S.addressModalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>Choose Delivery Address</h3>
                <div style={S.modalSubtitle}>
                  Fulfilled directly from <b>Tiptur HUB - KA44</b>
                </div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowAddressModal(false)}
              >
                <IconClose size={20} color="#64748b" />
              </button>
            </div>

            <div style={S.addressCardsList}>
              {SAVED_ADDRESSES.map((addr) => {
                const isSelected = selectedAddress.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    style={{
                      ...S.addressSelectCard,
                      ...(isSelected ? S.addressSelectCardActive : {}),
                    }}
                    onClick={() => {
                      setSelectedAddress(addr);
                      setShowAddressModal(false);
                      triggerToast(`Switched address to ${addr.type} (${addr.title})`);
                    }}
                  >
                    <div style={S.addressCardTop}>
                      <div style={S.addressCardTypeTitle}>
                        {renderAddressIcon(addr.type)}
                        <span style={S.addressTypeName}>{addr.title}</span>
                      </div>
                      {isSelected && (
                        <span style={S.selectedAddressTag}>
                          <IconCheck size={12} color="#0c831f" /> Current
                        </span>
                      )}
                    </div>
                    <div style={S.addressFlat}>{addr.flat}</div>
                    <div style={S.addressFullText}>{addr.address}</div>
                  </div>
                );
              })}
            </div>

            {/* Custom Address Input */}
            <div style={S.customAddressBox}>
              <input
                type="text"
                placeholder="Or type custom street / landmark in Tiptur Hub KA - 44..."
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                style={S.customInput}
              />
              <button
                type="button"
                style={S.useCustomBtn}
                onClick={() => {
                  if (customAddressInput.trim()) {
                    const customAddr = {
                      id: `addr_${Date.now()}`,
                      type: "Custom",
                      title: "Custom Location",
                      flat: "Doorstep",
                      address: `${customAddressInput.trim()}, Tiptur Hub KA - 44 - 572201`,
                      tag: "Custom",
                      iconType: "other",
                    };
                    setSelectedAddress(customAddr);
                    setShowAddressModal(false);
                    triggerToast("Custom delivery address saved!");
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          COUPONS & OFFERS MODAL
          ═══════════════════════════════════════════════════════════ */}
      {showCouponModal && (
        <div
          style={S.modalBackdrop}
          onClick={() => setShowCouponModal(false)}
        >
          <div
            style={S.couponModalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>Available Coupons & Offers</h3>
                <div style={S.modalSubtitle}>
                  Apply voucher for instant dark store savings
                </div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowCouponModal(false)}
              >
                <IconClose size={20} color="#64748b" />
              </button>
            </div>

            <div style={S.couponListModal}>
              {AVAILABLE_COUPONS.map((cp) => (
                <div key={cp.code} style={S.couponItemCard}>
                  <div style={S.couponItemTop}>
                    <span style={S.couponCodeBadge}>{cp.code}</span>
                    <button
                      type="button"
                      style={S.applyCouponCTA}
                      onClick={() => handleApplyCoupon(cp)}
                    >
                      APPLY
                    </button>
                  </div>
                  <div style={S.couponLabel}>{cp.label}</div>
                  <div style={S.couponDesc}>{cp.description}</div>
                  <div style={S.couponMinOrder}>
                    Minimum order: <b>₹{cp.minOrder}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Fullscreen Image Modal */}
      {showComingSoonModal && (
        <div style={S.comingSoonModalOverlay} onClick={() => setShowComingSoonModal(false)}>
          <div style={S.comingSoonModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.comingSoonModalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.2rem" }}>📢</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>Groceries Coming Soon in Namma Tiptur KA 44</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>AUDIT'X Dark Store Operations Hub (572201)</div>
                </div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowComingSoonModal(false)}
              >
                <IconClose size={18} color="#0f172a" />
              </button>
            </div>
            <div style={S.comingSoonModalImgContainer}>
              <img
                src="/coming-soon.jpg"
                alt="Coming Soon in Namma Tiptur KA 44 - AUDIT'X"
                style={S.comingSoonModalImg}
              />
            </div>
            <div style={{ padding: "12px 16px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
              <button
                type="button"
                style={{
                  background: "#0c831f",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(12, 131, 31, 0.3)"
                }}
                onClick={() => setShowComingSoonModal(false)}
              >
                Got It, Browse Available Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUTHENTIC BLINKIT COLOR PALETTE & DESIGN SYSTEM (CLEAN REAL UI THEME) ──
const S = {
  pageWrapper: {
    minHeight: "100vh",
    background: "#080C14",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
    color: "#0F172A",
  },
  mobileShell: {
    width: "100%",
    maxWidth: 440,
    minHeight: "100vh",
    background: "#F4F6FB",
    position: "relative",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.5)",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0C831F",
    color: "#FFFFFF",
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 6px 20px rgba(12, 131, 31, 0.35)",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  // Top Header (Delivery & Address Bar)
  topHeader: {
    background: "#FFFDF2",
    borderBottom: "1px solid #F2E3A0",
    position: "sticky",
    top: 0,
    zIndex: 50,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    padding: "12px 12px 10px",
  },
  headerContainer: {
    width: "100%",
  },
  headerNavRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandTag: {
    display: "flex",
    flexDirection: "column",
  },
  brandName: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#0C831F",
    lineHeight: 1,
  },
  storeBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#B45309",
    background: "#FEF3C7",
    padding: "1px 6px",
    borderRadius: 4,
    marginTop: 2,
    display: "inline-block",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  viewToggleBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 14px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(12, 131, 31, 0.25)",
  },
  staffPortalBtn: {
    background: "#FFFFFF",
    color: "#1E293B",
    border: "1px solid #CBD5E1",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  profileBtn: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "5px 10px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  profileAvatar: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#0c831f",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
  },
  profileBtnName: {
    maxWidth: 60,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  profileModalSheet: {
    background: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px 20px 32px",
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
  },
  profileHeroCard: {
    background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
    borderRadius: 16,
    padding: "18px",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    boxShadow: "0 4px 16px rgba(6, 78, 59, 0.2)",
  },
  profileHeroAvatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#10b981",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 900,
    border: "2px solid #a7f3d0",
  },
  profileHeroInfo: {
    flex: 1,
  },
  profileHeroName: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.01em",
  },
  profileHeroPhone: {
    fontSize: 13,
    color: "#a7f3d0",
    marginTop: 2,
    fontWeight: 600,
  },
  profileHeroBadge: {
    display: "inline-block",
    background: "rgba(255,255,255,0.15)",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    marginTop: 4,
  },
  profileSectionBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 14,
  },
  profileSectionHeading: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },
  fixedBadge: {
    marginLeft: "auto",
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 4,
  },
  profileAddressText: {
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 1.4,
  },
  profileStatsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  profileStatCol: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "center",
  },
  statLabel: {
    display: "block",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 2,
  },
  statValue: {
    display: "block",
    fontSize: 15,
    color: "#0f172a",
    fontWeight: 800,
  },
  profileActionsCol: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  profileEditBtn: {
    width: "100%",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileDedicatedPageBtn: {
    width: "100%",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileLogoutBtn: {
    width: "100%",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
    padding: "11px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    marginTop: 4,
  },
  loginModalSheet: {
    background: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "24px 20px 32px",
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
  },
  loginPromptText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  loginPhoneInputWrapper: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    background: "#f8fafc",
    overflow: "hidden",
    marginBottom: 16,
  },
  loginCountryCode: {
    padding: "12px 14px",
    background: "#f1f5f9",
    fontWeight: 800,
    fontSize: 14,
    color: "#334155",
    borderRight: "1px solid #e2e8f0",
  },
  loginPhoneInput: {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "12px 14px",
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    background: "transparent",
  },
  loginSubmitBtn: {
    width: "100%",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "13px 20px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.25)",
  },
  loginErrorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 14,
    textAlign: "center",
  },
  demoOtpBanner: {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#92400e",
    marginBottom: 14,
  },
  autoFillBtnSmall: {
    background: "#b45309",
    color: "#ffffff",
    border: "none",
    padding: "4px 8px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  loginOtpInput: {
    width: "100%",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px",
    fontSize: 22,
    fontWeight: 900,
    textAlign: "center",
    letterSpacing: "0.25em",
    outline: "none",
    marginBottom: 16,
    background: "#f8fafc",
    boxSizing: "border-box",
  },
  loginNameInput: {
    width: "100%",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
  },
  // Delivery ETA & Address Switcher
  etaAddressBar: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
  },
  etaAddressLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    flex: 1,
  },
  etaBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  lightningPill: {
    background: "#F7C434",
    width: 20,
    height: 20,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  etaTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  etaMinutes: {
    color: "#0F172A",
    fontWeight: 900,
  },
  addressSnippetRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  addressTypeBadge: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    background: "#F1F5F9",
    padding: "1px 6px",
    borderRadius: 4,
    fontWeight: 700,
    color: "#1E293B",
    fontSize: 11,
  },
  addressTypeLabel: {
    fontSize: 11,
  },
  addressSnippetText: {
    fontWeight: 600,
    color: "#334155",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "60vw",
  },
  changeAddressBtn: {
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    color: "#0C831F",
    fontWeight: 800,
    fontSize: 12,
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
    marginLeft: 10,
    flexShrink: 0,
  },

  // ── CHECKOUT PAGE STYLING (EXACT WIREFRAME MATCH) ──
  checkoutMain: {
    minHeight: "calc(100vh - 120px)",
    paddingBottom: 20,
  },
  checkoutContainer: {
    width: "100%",
    padding: "10px 12px 140px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxSizing: "border-box",
  },
  checkoutNavBackRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  backToCatalogBtn: {
    background: "transparent",
    border: "none",
    color: "#0C831F",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 0",
  },
  cartCountHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
  },
  checkoutCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "16px 16px",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.03)",
  },
  checkoutEtaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  checkoutEtaLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  checkoutEtaPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    padding: "3px 8px",
    borderRadius: 6,
    width: "fit-content",
  },
  checkoutEtaTime: {
    fontSize: 13,
    fontWeight: 800,
    color: "#92400E",
  },
  checkoutAddressSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  changeBtnSmall: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    color: "#0C831F",
    fontWeight: 800,
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  freeDeliveryNotice: {
    background: "#F0FDF4",
    border: "1px solid #DCFCE7",
    borderRadius: 8,
    padding: "10px 12px",
  },
  freeDeliveryLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    marginBottom: 6,
  },
  unlockedFreeText: {
    color: "#0C831F",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  lockedFreeText: {
    color: "#166534",
    fontWeight: 600,
  },
  deliveryFeeBadge: {
    fontWeight: 800,
    fontSize: 11,
    color: "#0C831F",
    background: "#DCFCE7",
    padding: "2px 6px",
    borderRadius: 4,
  },
  progressTrack: {
    height: 5,
    background: "#DCFCE7",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#0C831F",
    transition: "width 0.3s ease",
  },

  // 2. ITEMS ADDED
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0F172A",
    letterSpacing: 0.3,
    margin: 0,
  },
  itemSubtextCount: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748B",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  itemCardRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottom: "1px solid #F1F5F9",
  },
  itemImgWrapper: {
    position: "relative",
    width: 58,
    height: 58,
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    overflow: "hidden",
    flexShrink: 0,
  },
  itemThumbnail: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  itemOosOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 2,
  },
  itemInfoCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1E293B",
    margin: 0,
    lineHeight: 1.3,
  },
  itemWeight: {
    fontSize: 11,
    color: "#64748B",
  },
  itemPriceRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  itemFinalPrice: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  itemMrpStrike: {
    fontSize: 11,
    color: "#94A3B8",
    textDecoration: "line-through",
  },
  aisleBadge: {
    fontSize: 10,
    color: "#64748B",
    background: "#F1F5F9",
    padding: "1px 6px",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    gap: 3,
  },
  stepperBox: {
    display: "flex",
    alignItems: "center",
    background: "#0C831F",
    borderRadius: 6,
    overflow: "hidden",
    boxShadow: "0 2px 6px rgba(12, 131, 31, 0.2)",
    flexShrink: 0,
  },
  stepperMinusBtn: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: 15,
    padding: "6px 10px",
    cursor: "pointer",
  },
  stepperQty: {
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: 13,
    minWidth: 18,
    textAlign: "center",
  },
  stepperPlusBtn: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: 15,
    padding: "6px 10px",
    cursor: "pointer",
  },
  emptyCartState: {
    textAlign: "center",
    padding: "24px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  emptyCartTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#64748B",
  },
  browseCatalogBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 16px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },

  // 2. UPSELL CAROUSEL ("BEFORE YOU CHECKOUT")
  upsellTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  upsellSubtitle: {
    fontSize: 11,
    color: "#64748B",
  },
  upsellCarouselRow: {
    display: "flex",
    overflowX: "auto",
    gap: 10,
    paddingBottom: 6,
  },
  upsellItemCard: {
    minWidth: 125,
    maxWidth: 130,
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "#FFFFFF",
    flexShrink: 0,
  },
  upsellImage: {
    width: "100%",
    height: 70,
    objectFit: "contain",
    borderRadius: 4,
    marginBottom: 6,
  },
  upsellCardContent: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  upsellName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1E293B",
    lineHeight: 1.25,
    height: 28,
    overflow: "hidden",
  },
  upsellWeight: {
    fontSize: 10,
    color: "#64748B",
  },
  upsellFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  upsellPrice: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0F172A",
  },
  upsellAddBtn: {
    background: "#F0FDF4",
    border: "1px solid #0C831F",
    color: "#0C831F",
    fontWeight: 800,
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 4,
    cursor: "pointer",
  },

  // 3. COUPONS & DISCOUNTS
  couponWidget: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  couponLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  couponIconWrapper: {
    background: "#F0FDF4",
    border: "1px solid #DCFCE7",
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  couponAppliedCode: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0C831F",
  },
  couponAppliedDesc: {
    fontSize: 11,
    color: "#475569",
  },
  couponPromptTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  couponPromptSub: {
    fontSize: 11,
    color: "#64748B",
  },
  removeCouponBtn: {
    background: "#FEF2F2",
    border: "1px solid #FEE2E2",
    color: "#EF4444",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  couponArrowRight: {
    display: "flex",
    alignItems: "center",
  },
  savingsHighlightBanner: {
    marginTop: 10,
    padding: "8px 10px",
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "#166534",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  // 4. BILL BREAKDOWN
  billBreakdown: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
  },
  billLabel: {
    color: "#475569",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  billValue: {
    color: "#0F172A",
    fontWeight: 700,
  },
  billDiscountLabel: {
    color: "#0C831F",
    fontWeight: 600,
  },
  billDiscountValue: {
    color: "#0C831F",
    fontWeight: 800,
  },
  freeDeliveryPill: {
    fontSize: 10,
    color: "#0C831F",
    background: "#DCFCE7",
    padding: "1px 5px",
    borderRadius: 4,
    fontWeight: 700,
  },
  billFreeHighlight: {
    color: "#0C831F",
    fontWeight: 800,
  },
  billDivider: {
    height: 1,
    background: "#E2E8F0",
    margin: "4px 0",
  },
  billGrandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0F172A",
  },
  taxInclusiveSub: {
    fontSize: 10,
    color: "#64748B",
  },
  grandTotalAmount: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0F172A",
  },

  // 5. DELIVERY INSTRUCTIONS
  instructionsSubtext: {
    fontSize: 11,
    color: "#64748B",
  },
  instructionsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  instructionChipBtn: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    transition: "all 0.15s ease",
  },
  instructionChipActive: {
    background: "#F0FDF4",
    borderColor: "#0C831F",
    color: "#0C831F",
    fontWeight: 700,
  },
  chipIconWrapper: {
    display: "flex",
    alignItems: "center",
  },
  chipLabel: {
    fontSize: 12,
  },
  chipActiveCheck: {
    display: "flex",
    alignItems: "center",
  },
  darkStoreGuaranteeNote: {
    marginTop: 14,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  },
  guaranteeTextCol: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  guaranteeTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#1E293B",
  },
  guaranteeDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 1.35,
  },

  // 6. BOTTOM STICKY CHECKOUT BAR
  bottomStickyBar: {
    position: "fixed",
    bottom: 58,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 440,
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.08)",
    padding: "10px 14px",
    zIndex: 60,
    boxSizing: "border-box",
  },
  stickyBarInner: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  stickyPriceCol: {
    display: "flex",
    flexDirection: "column",
  },
  stickyTotalRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },
  stickyTotalAmount: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0F172A",
  },
  stickyTotalWord: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    textTransform: "uppercase",
  },
  stickySavingsNote: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0C831F",
  },
  proceedToPayCTA: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: "13px 24px",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.5,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.3)",
    transition: "transform 0.1s ease",
  },

  // ── CATALOG BROWSE VIEW ──
  catalogMain: {
    paddingBottom: 100,
  },
  catalogContainer: {
    width: "100%",
    padding: "10px 12px 140px",
    boxSizing: "border-box",
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchFieldWrapper: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  searchInput: {
    border: "none",
    outline: "none",
    fontSize: 13,
    color: "#0F172A",
    width: "100%",
    background: "transparent",
    fontWeight: 600,
  },
  searchClearBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  categoryTabsRow: {
    display: "flex",
    overflowX: "auto",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 14,
  },
  categoryTabPill: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    color: "#475569",
    fontWeight: 700,
    fontSize: 12,
    padding: "7px 14px",
    borderRadius: 20,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  categoryTabActive: {
    background: "#0C831F",
    borderColor: "#0C831F",
    color: "#FFFFFF",
  },
  catalogGridHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  catalogTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0F172A",
    margin: 0,
  },
  catalogItemCount: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 600,
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  productCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  productImageContainer: {
    position: "relative",
    height: 130,
    background: "#F8FAFC",
    borderBottom: "1px solid #F1F5F9",
  },
  productImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 8,
  },
  etaBadgeOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 800,
    color: "#92400E",
    display: "flex",
    alignItems: "center",
    gap: 3,
  },
  oosBadgeOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(15, 23, 42, 0.75)",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  productDetailsCol: {
    padding: 10,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    justifyContent: "space-between",
  },
  productAisleRow: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
  },
  productName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1E293B",
    lineHeight: 1.3,
    margin: "0 0 2px",
    height: 32,
    overflow: "hidden",
  },
  productWeight: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 8,
  },
  productActionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productFinalPrice: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0F172A",
    marginRight: 4,
  },
  productMrpStrike: {
    fontSize: 10,
    color: "#94A3B8",
    textDecoration: "line-through",
  },
  productAddBtn: {
    background: "#F0FDF4",
    border: "1px solid #0C831F",
    color: "#0C831F",
    fontWeight: 900,
    fontSize: 12,
    padding: "5px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  productOosBtn: {
    background: "#F1F5F9",
    border: "1px solid #CBD5E1",
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 700,
    padding: "5px 10px",
    borderRadius: 6,
    cursor: "not-allowed",
  },
  productStepper: {
    display: "flex",
    alignItems: "center",
    background: "#0C831F",
    borderRadius: 6,
    overflow: "hidden",
  },
  stepperSmallBtn: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: 13,
    padding: "4px 8px",
    cursor: "pointer",
  },
  stepperSmallQty: {
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: 12,
    minWidth: 16,
    textAlign: "center",
  },

  // Floating Quick Cart Bar (Catalog view)
  catalogFloatingCartBar: {
    position: "fixed",
    bottom: 66,
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 24px)",
    maxWidth: 416,
    zIndex: 45,
    boxSizing: "border-box",
  },
  floatingCartInner: {
    width: "100%",
    background: "#0C831F",
    color: "#FFFFFF",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(12, 131, 31, 0.4)",
    boxSizing: "border-box",
  },
  floatingCartLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  floatingBagPill: {
    background: "rgba(255, 255, 255, 0.2)",
    padding: 6,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingCartCount: {
    fontSize: 14,
    fontWeight: 900,
  },
  floatingSavings: {
    fontSize: 11,
    opacity: 0.9,
  },
  floatingViewCartCTA: {
    background: "#FFFFFF",
    color: "#0C831F",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  // ── MODALS (PAYMENT, ADDRESS, COUPON) ──
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.6)",
    zIndex: 90,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  paymentModalSheet: {
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 440,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px 16px 24px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.2)",
    boxSizing: "border-box",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0F172A",
    margin: 0,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    background: "#F1F5F9",
    border: "none",
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  paymentOptionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 18,
  },
  paymentCardOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    cursor: "pointer",
    background: "#FFFFFF",
    transition: "border-color 0.15s ease",
  },
  paymentCardOptionActive: {
    borderColor: "#0C831F",
    background: "#F0FDF4",
  },
  paymentOptionLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  paymentIconBadge: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paymentMethodTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1E293B",
  },
  paymentMethodSub: {
    fontSize: 11,
    color: "#64748B",
  },
  radioBtn: {
    accentColor: "#0C831F",
    width: 16,
    height: 16,
    cursor: "pointer",
  },
  upiAppsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    padding: "8px 10px",
    background: "#F8FAFC",
    borderRadius: 8,
    marginBottom: 4,
  },
  upiAppBtn: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  upiAppBtnActive: {
    borderColor: "#0C831F",
    color: "#0C831F",
    background: "#F0FDF4",
  },
  modalFooterCTA: {
    paddingTop: 8,
  },
  confirmPayBtn: {
    width: "100%",
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: "14px 20px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.35)",
  },

  // Address Modal
  addressModalSheet: {
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 440,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px 16px 24px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  addressCardsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  addressSelectCard: {
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    background: "#FFFFFF",
  },
  addressSelectCardActive: {
    borderColor: "#0C831F",
    background: "#F0FDF4",
  },
  addressCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  addressCardTypeTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  addressTypeName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  selectedAddressTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0C831F",
    background: "#DCFCE7",
    padding: "2px 6px",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  addressFlat: {
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
  },
  addressFullText: {
    fontSize: 11,
    color: "#64748B",
  },
  customAddressBox: {
    display: "flex",
    gap: 8,
  },
  customInput: {
    flex: 1,
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    outline: "none",
  },
  useCustomBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },

  // Coupon Modal
  couponModalSheet: {
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 440,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px 16px 24px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  couponListModal: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  couponItemCard: {
    border: "1px dashed #CBD5E1",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#F8FAFC",
  },
  couponItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  couponCodeBadge: {
    background: "#FEF3C7",
    color: "#B45309",
    fontWeight: 900,
    fontSize: 13,
    padding: "3px 8px",
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  applyCouponCTA: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    fontWeight: 800,
    fontSize: 11,
    padding: "4px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  couponLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 2,
  },
  couponDesc: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 4,
  },
  couponMinOrder: {
    fontSize: 10,
    color: "#64748B",
  },

  // ── 7. BOTTOM NAVIGATION BAR (Home, Order Again, Categories, Explore Namma Tiptur) ──
  bottomNavBar: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 440,
    height: 56,
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "4px 4px 6px",
    zIndex: 75,
    boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.06)",
    boxSizing: "border-box",
  },
  bottomNavTabBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    flex: 1,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 2px",
    transition: "color 0.15s ease",
  },
  bottomNavTabActive: {
    color: "#0C831F",
  },
  bottomNavLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#64748B",
    whiteSpace: "nowrap",
    letterSpacing: -0.2,
  },
  bottomNavLabelActive: {
    color: "#0C831F",
    fontWeight: 800,
  },

  // ── TAB VIEWS (ORDER AGAIN, CATEGORIES, EXPLORE NAMMA TIPTUR) ──
  tabViewContainer: {
    paddingBottom: 85,
  },
  tabHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: "1px solid #E2E8F0",
  },
  tabTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#0F172A",
    margin: "0 0 2px",
    letterSpacing: -0.3,
  },
  tabSubtitle: {
    fontSize: 12,
    color: "#64748B",
    margin: 0,
  },
  reorderBadgePill: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "#DCFCE7",
    color: "#0C831F",
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
    flexShrink: 0,
  },
  sectionHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionSubTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  sectionSubCount: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 600,
  },

  // Past Orders Card
  pastOrderCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
  },
  pastOrderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  pastOrderNumber: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  pastOrderDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  pastOrderDeliveredPill: {
    background: "#DCFCE7",
    color: "#0C831F",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 4,
  },
  pastOrderItemsSummary: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 10,
    lineHeight: 1.35,
  },
  pastOrderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTop: "1px solid #F1F5F9",
  },
  pastOrderTotal: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },
  reorderAllBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    boxShadow: "0 2px 6px rgba(12, 131, 31, 0.25)",
  },

  // Categories Vertical Grid
  categoriesVerticalGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  categoryDepartmentCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
    transition: "border-color 0.15s ease",
  },
  categoryCardContent: {
    flex: 1,
  },
  catBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  catTagBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 4,
  },
  catCountText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 600,
  },
  catDepartmentTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
    margin: "0 0 2px",
  },
  catDepartmentDesc: {
    fontSize: 11,
    color: "#64748B",
    margin: "0 0 6px",
  },
  catAisleZone: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    color: "#475569",
    fontWeight: 600,
  },
  catArrowIcon: {
    marginLeft: 10,
    display: "flex",
    alignItems: "center",
  },

  // Explore Namma Tiptur
  tipturHeroBanner: {
    background: "linear-gradient(135deg, #0C831F 0%, #064E3B 100%)",
    color: "#FFFFFF",
    borderRadius: 14,
    padding: "16px 16px",
    marginBottom: 16,
    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.25)",
  },
  heroBannerPill: {
    background: "rgba(255, 255, 255, 0.22)",
    backdropFilter: "blur(8px)",
    color: "#FEF3C7",
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 12px",
    borderRadius: 20,
    display: "inline-block",
    letterSpacing: 0.6,
    marginBottom: 8,
    border: "1px solid rgba(255, 255, 255, 0.28)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  },
  heroBannerTitle: {
    fontSize: 18,
    fontWeight: 900,
    margin: "0 0 6px",
    color: "#FFFFFF",
    lineHeight: 1.3,
    textAlign: "center",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
  },
  heroBannerSub: {
    fontSize: 11,
    color: "#F1F5F9",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.45,
    textAlign: "center",
    textShadow: "0 1px 4px rgba(0,0,0,0.85)",
    maxWidth: 380,
  },

  // Ganesha Utsava Grand Showcase
  ganeshaCard: {
    background: "linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)",
    border: "1.5px solid #FDE68A",
    borderRadius: 14,
    padding: "16px 14px",
    marginBottom: 18,
    boxShadow: "0 2px 10px rgba(245, 158, 11, 0.08)",
  },
  ganeshaHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  ganeshaIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    flexShrink: 0,
    boxShadow: "0 3px 8px rgba(217, 119, 6, 0.3)",
  },
  ganeshaTitleArea: {
    flex: 1,
  },
  ganeshaHeritagePill: {
    background: "#FEF3C7",
    color: "#92400E",
    border: "1px solid #FDE68A",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 4,
    display: "inline-block",
    marginBottom: 4,
  },
  ganeshaMainTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#78350F",
    margin: "0 0 2px",
    lineHeight: 1.3,
  },
  ganeshaSubTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#B45309",
    margin: 0,
  },
  ganeshaLangRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "1px solid #FDE68A",
    paddingBottom: 10,
  },
  ganeshaDropdownWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#FFFFFF",
    border: "1.5px solid #F59E0B",
    borderRadius: 8,
    padding: "5px 10px",
    boxShadow: "0 1px 4px rgba(245, 158, 11, 0.12)",
    cursor: "pointer",
  },
  ganeshaSelectDropdown: {
    background: "transparent",
    border: "none",
    color: "#78350F",
    fontSize: 13,
    fontWeight: 800,
    outline: "none",
    cursor: "pointer",
    padding: "2px 4px",
  },
  ganeshaStoryCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  ganeshaSectionBlock: {
    background: "#FFFFFF",
    border: "1px solid #FEF3C7",
    borderRadius: 10,
    padding: "12px",
  },
  ganeshaLangHeaderBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#B45309",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  ganeshaPara: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.6,
    margin: "0 0 8px",
    textAlign: "justify",
  },
  ganeshaStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    marginTop: 10,
  },
  ganeshaStatCard: {
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 8,
    padding: "8px 10px",
  },
  ganeshaStatLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#92400E",
    marginBottom: 2,
  },
  ganeshaStatVal: {
    fontSize: 11,
    fontWeight: 800,
    color: "#78350F",
    lineHeight: 1.25,
  },

  // Places & Restaurants List
  placesSection: {
    marginBottom: 20,
  },
  placesListCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  placeCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: "10px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  placeTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  placeTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  placeMainName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  placeKnName: {
    fontSize: 12,
    color: "#0C831F",
    fontWeight: 700,
  },
  placeBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
  },
  placeDesc: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 1.4,
    margin: "4px 0 8px",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    height: 31,
  },
  placeFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: 600,
    borderTop: "1px solid #F1F5F9",
    paddingTop: 8,
  },
  placeLocText: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  placeRatingTag: {
    background: "#DCFCE7",
    color: "#15803D",
    padding: "2px 7px",
    borderRadius: 5,
    fontWeight: 800,
    fontSize: 11,
  },

  // Trending Cafes Grid
  cafesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 10,
  },
  cafeCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    minHeight: 148,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.03)",
  },
  cafeBody: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  cafeTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
    gap: 4,
  },
  cafeName: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
    lineHeight: 1.25,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cafeKnName: {
    fontSize: 10,
    color: "#0C831F",
    fontWeight: 700,
    marginTop: 1,
  },
  cafeRating: {
    background: "#FEF3C7",
    color: "#92400E",
    fontSize: 10,
    fontWeight: 800,
    padding: "1px 5px",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  cafeDesc: {
    fontSize: 10,
    color: "#64748B",
    margin: "2px 0 6px",
    lineHeight: 1.35,
    height: 27,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  cafeBottom: {
    marginTop: "auto",
    paddingTop: 4,
  },
  cafeTypePill: {
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    display: "inline-block",
  },

  // Organic Farm Showcase
  farmCard: {
    background: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
    border: "1.5px solid #BBF7D0",
    borderRadius: 14,
    padding: "16px 14px",
    boxShadow: "0 2px 8px rgba(12, 131, 31, 0.08)",
  },
  farmHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  farmTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#14532D",
    margin: "0 0 2px",
  },
  farmKnTitle: {
    fontSize: 12,
    color: "#0C831F",
    fontWeight: 800,
  },
  farmBadge: {
    background: "#DCFCE7",
    color: "#15803D",
    border: "1px solid #BBF7D0",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 4,
  },
  farmDesc: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.55,
    margin: "6px 0 10px",
  },
  farmHighlightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 6,
    marginBottom: 10,
  },
  farmChip: {
    background: "#FFFFFF",
    border: "1px solid #DCFCE7",
    color: "#166534",
    fontSize: 10,
    fontWeight: 700,
    padding: "5px 8px",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  farmFooter: {
    fontSize: 11,
    color: "#475569",
    borderTop: "1px solid #DCFCE7",
    paddingTop: 8,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  tipturHighlightsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 10,
  },
  tipturHighlightCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 12px",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  highlightIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0F172A",
    margin: "0 0 2px",
  },
  highlightDesc: {
    fontSize: 11,
    color: "#64748B",
    margin: 0,
    lineHeight: 1.35,
  },

  // ── CINEMATIC 4K / 1080p DRONE VIDEO SHOWCASE STYLES ──
  // ── CINEMATIC MERGED BACKGROUND VIDEO HERO STYLES ──
  tipturHeroVideoBanner: {
    position: "relative",
    width: "100%",
    minHeight: 185,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.15)",
    border: "1.5px solid #CBD5E1",
    background: "#000000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mergedBgVideoElement: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "contrast(1.02) saturate(1.06)",
    zIndex: 1,
    pointerEvents: "none",
  },
  tipturHeroOverlay: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    background: "transparent",
  },
  heroBannerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#FFFFFF",
    letterSpacing: "0.3px",
    textShadow: "0 2px 14px rgba(0, 0, 0, 0.95), 0 0 24px rgba(0, 0, 0, 0.85), 0 1px 3px #000000",
    textAlign: "center",
    maxWidth: "96%",
    lineHeight: 1.35,
  },
  liveDroneDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#22C55E",
    boxShadow: "0 0 8px #22C55E",
    display: "inline-block",
  },

  // Ganesha Photo Card (Fully Clear Frame, Uncropped)
  ganeshaImageCard: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 14,
    border: "2px solid #F59E0B",
    background: "#FFFBEB",
    padding: 8,
    boxShadow: "0 4px 16px rgba(245, 158, 11, 0.2)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  ganeshaHeroImage: {
    width: "100%",
    maxWidth: 380,
    height: "auto",
    maxHeight: 460,
    objectFit: "contain",
    borderRadius: 8,
    display: "block",
  },
  ganeshaFrameCaption: {
    marginTop: 8,
    width: "100%",
    background: "linear-gradient(90deg, #FEF3C7 0%, #FDE68A 50%, #FEF3C7 100%)",
    border: "1px solid #F59E0B",
    borderRadius: 6,
    padding: "6px 10px",
    color: "#78350F",
    fontSize: 11.5,
    fontWeight: 800,
    textAlign: "center",
  },

  // Farm Video Player
  farmVideoBox: {
    position: "relative",
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    background: "#064E3B",
    margin: "8px 0 10px",
    border: "1px solid #10B981",
    boxShadow: "0 4px 12px rgba(6, 78, 59, 0.2)",
  },
  farmVideoPlayer: {
    width: "100%",
    maxHeight: 280,
    objectFit: "cover",
    display: "block",
  },
  farmVideoOverlayTop: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  farmHdBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(6, 78, 59, 0.8)",
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
  },
  farmVideoOverlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(to top, rgba(6, 78, 59, 0.95) 0%, rgba(6, 78, 59, 0) 100%)",
    padding: "16px 10px 6px",
    color: "#DCFCE7",
    fontSize: 10,
    fontWeight: 700,
  },

  // Restaurant & Cafe Thumbnail Images
  restImageWrap: {
    width: "100%",
    height: 135,
    overflow: "hidden",
    borderRadius: 10,
    marginBottom: 8,
    background: "#F1F5F9",
  },
  restThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  cafeImageWrap: {
    width: "100%",
    height: 90,
    overflow: "hidden",
    borderRadius: 8,
    marginBottom: 6,
    background: "#F8FAFC",
  },
  cafeThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  // ── Full Page Coming Soon Poster Styles ──
  fullPageComingSoonWrapper: {
    width: "100%",
    background: "#080c14",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    animation: "fadeIn 0.25s ease-out",
  },
  fullPageComingSoonTopBar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
    borderBottom: "1.5px solid #10b981",
    position: "sticky",
    top: 54,
    zIndex: 10,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
  },
  fullPageCatTag: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "0.85rem",
    fontWeight: 800,
    color: "#a7f3d0",
  },
  fullPagePulseDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 8px #34d399",
  },
  fullPageShortcuts: {
    display: "flex",
    gap: 8,
  },
  quickTabChoc: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: "0.75rem",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(12, 131, 31, 0.35)",
  },
  quickTabFrame: {
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid #475569",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: "0.75rem",
    fontWeight: 800,
    cursor: "pointer",
  },
  fullPageImageContainer: {
    width: "100%",
    background: "#0f172a",
    display: "flex",
    justifyContent: "center",
  },
  fullPageImg: {
    width: "100%",
    maxWidth: 440,
    height: "auto",
    display: "block",
  },
  fullPageComingSoonBottomBar: {
    width: "100%",
    padding: "16px 14px 28px",
    background: "#ffffff",
    borderTop: "1.5px solid #bbf7d0",
    textAlign: "center",
    boxShadow: "0 -6px 20px rgba(0,0,0,0.08)",
  },
  fullPageBottomBtnChoc: {
    background: "linear-gradient(135deg, #15803d, #0c831f)",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "11px 16px",
    fontSize: "0.82rem",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12,131,31,0.25)",
  },
  fullPageBottomBtnFrames: {
    background: "linear-gradient(135deg, #1e293b, #334155)",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "11px 16px",
    fontSize: "0.82rem",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(30,41,59,0.25)",
  },
  comingSoonModalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(6px)",
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  comingSoonModalCard: {
    background: "#ffffff",
    borderRadius: 20,
    maxWidth: 440,
    width: "100%",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  },
  comingSoonModalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
  },
  comingSoonModalImgContainer: {
    overflowY: "auto",
    padding: "12px",
    background: "#f1f5f9",
    display: "flex",
    justifyContent: "center",
  },
  comingSoonModalImg: {
    width: "100%",
    maxHeight: "68vh",
    objectFit: "contain",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  },
};
