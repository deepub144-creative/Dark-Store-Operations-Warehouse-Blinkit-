"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { CATALOG } from "@/lib/items";
import { getDefaultItemStock, mergeCatalogItems, isPuppyFrame } from "@/lib/hubState";
import { downloadDeliverySlipPdf } from "@/lib/orderSlipPdf";
import {
  broadcastEvent,
  subscribeToEvents,
  saveLiveOrder,
  getAllLiveOrders,
  updateLiveOrder,
  clearAllLiveOrders,
  getAllLiveComplaints,
  sanitizeComplaints,
  subscribeToCloudHub,
  fetchCloudHubState,
  dispatchCloudAction,
  verifyPlacedOrderStatus,
  reserveCheckoutStock,
  releaseCheckoutReservation,
  attemptSilentSessionRefresh,
  getOrCreateDeviceUid,
} from "@/lib/realtimeSync";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  createIdempotencyKey,
  isOnlineNow,
  subscribeNetworkStatus,
  withIdempotentLock,
} from "@/lib/apiClient";
import { safeArr, safeNum, safeStorage, validateCustomerBoundary } from "@/lib/safeData";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import { getRandomStagingRack } from "@/lib/roles";
import DiwaliTheme from "@/lib/diwaliTheme";
import DiwaliCrackers from "@/lib/diwaliCrackers";
import AuditxLogo from "@/components/AuditxLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import AuditxSuiteTopBar from "@/components/AuditxSuiteTopBar";
import {
  IOSMobileShell,
  IOSNavBar,
  IOSTabBar,
  IOSBottomSheet,
  IOSStepper,
  IOSToast,
  IOSButton,
  IOSGroupedList,
  IOSListRow,
  OrderingSkeletonScreen,
} from "@/components/ios";

const retryImport = (loader) =>
  loader().catch(
    () => new Promise((resolve, reject) => setTimeout(() => loader().then(resolve, reject), 450))
  );

// Route-level / heavy modal code-splitting for 60fps initial mobile paint
const AuditxMiniAssistant = dynamic(() => retryImport(() => import("@/components/AuditxMiniAssistant")), {
  ssr: false,
  loading: () => null,
});
const OrderPlacedSheet = dynamic(() => retryImport(() => import("@/components/ui/OrderPlacedSheet")), {
  ssr: false,
  loading: () => null,
});

const LittlePenguin = dynamic(() => retryImport(() => import("@/components/LittlePenguin")), {
  ssr: false,
  loading: () => null,
});
import {
  IconLightning,
  IconRealisticScooter,
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
  IconRealLogoUPI,
  IconRealLogoPhonePe,
  IconRealLogoGooglePay,
  IconRealLogoPaytm,
  IconRealLogoAuditxWallet,
} from "@/components/RealIcons";

const WALLET_LIMIT = 1000000;
const FREE_DELIVERY_THRESHOLD = 1;

const SAVED_ADDRESSES = [
  {
    id: "addr_kfgsc",
    type: "KFGSC Delivery Point",
    title: "KFGSC Delivery Point",
    flat: "KFGSC Campus",
    address: "KFGSC , Tiptur 572201",
    tag: "Fixed Location",
    iconType: "home",
  },
];

const AVAILABLE_COUPONS = [
  {
    code: "TIPTUR10",
    label: "10% Instant Discount",
    description: "Save 10% up to ₹50 on authentic dark store orders",
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
    description: "100% Free delivery & ₹0 platform fee across all dark store orders",
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

const SEARCH_PLACEHOLDER_ITEMS = [
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
];

// Isolated typewriter placeholder keeps 28-65ms ticks inside a tiny leaf without re-rendering OrderingAppPage
const OrderingSearchInput = memo(function OrderingSearchInput({
  value,
  onChange,
  onClear,
  inputRef = null,
  sticky = false,
  S,
}) {
  const [placeholder, setPlaceholder] = useState('Search "Beatss Milk Chocolate"...');
  const [itemIdx, setItemIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charPos, setCharPos] = useState(0);

  useEffect(() => {
    if (value) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const curItem = SEARCH_PLACEHOLDER_ITEMS[itemIdx % SEARCH_PLACEHOLDER_ITEMS.length];
    const full = `Search "${curItem}"...`;
    let pauseTimer = null;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (charPos < full.length) {
          setCharPos((p) => p + 1);
          setPlaceholder(full.slice(0, charPos + 1));
        } else {
          pauseTimer = setTimeout(() => setIsDeleting(true), 2000);
        }
      } else if (charPos > 9) {
        setCharPos((p) => p - 1);
        setPlaceholder(full.slice(0, charPos - 1));
      } else {
        setIsDeleting(false);
        setItemIdx((p) => (p + 1) % SEARCH_PLACEHOLDER_ITEMS.length);
      }
    }, isDeleting ? 65 : 120);

    return () => {
      clearTimeout(timer);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [charPos, isDeleting, itemIdx, value]);

  return (
    <div style={sticky ? { ...S.searchContainer, position: "sticky", top: 6, zIndex: 20 } : S.searchContainer}>
      <div data-dfx="search" style={S.searchFieldWrapper}>
        <IconSearch size={18} color="#8E8E93" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search chocolates and wall frames"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={S.searchInput}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            style={S.searchClearBtn}
            onClick={onClear}
          >
            <IconClose size={16} color="#8E8E93" />
          </button>
        )}
      </div>
    </div>
  );
});

function CatalogBoundaryProbe() {
  if (typeof window !== "undefined" && window.__AUDITX_FORCE_CATALOG_CRASH__ === true) {
    throw new Error("Simulated child render failure for boundary verification");
  }
  return null;
}

const OrderingProductCard = memo(function OrderingProductCard({
  item,
  idx,
  qty,
  availableUnits,
  isOos,
  isSoldOut,
  isChoc,
  isFrame,
  isStoreOpen,
  onUpdateQty,
  onOpenComingSoon,
  onStoreClosedToast,
  S,
}) {
  const safePrice = safeNum(item.price, 0);
  const safeMrp = safeNum(item.mrp, safePrice);
  const safeImage = item.image || "/auditx-logo.png";

  return (
    <div
      data-dfx="card"
      data-sku={item.sku}
      data-available={availableUnits}
      className="ios-stagger-item"
      style={{
        ...S.productCard,
        animationDelay: `${Math.min(idx, 8) * 30}ms`,
        opacity: isSoldOut ? 0.72 : isOos ? 0.65 : 1,
        borderRadius: 18,
        background: "var(--ios-card)",
        border: isOos
          ? "1px solid rgba(255, 59, 48, 0.45)"
          : item.comingSoon
            ? "1px solid rgba(255, 149, 0, 0.4)"
            : "0.5px solid var(--ios-card-border)",
        boxShadow: "var(--ios-card-shadow)",
      }}
    >
      <div style={S.productImageContainer}>
        <img
          src={safeImage}
          alt={item.name || "Product"}
          width={140}
          height={116}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            if (e.currentTarget.dataset.fbApplied) return;
            e.currentTarget.dataset.fbApplied = "1";
            e.currentTarget.src = "/auditx-logo.png";
          }}
          style={{
            ...S.productImg,
            objectFit: "contain",
            ...(isOos ? { filter: "grayscale(35%)" } : {}),
          }}
        />
        {isSoldOut ? (
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#FF3B30",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 6,
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              gap: 3,
              zIndex: 2,
            }}
          >
            <span>⛔ SOLD OUT</span>
          </div>
        ) : item.comingSoon ? (
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#FF9500",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 6,
            }}
          >
            <span>⏳ SOON</span>
          </div>
        ) : isChoc ? (
          <div
            data-dfx="badge"
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#0C831F",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            <span>{item.isCustomPutaway ? `₹${safePrice} NEW` : `₹${safePrice}`}</span>
          </div>
        ) : isFrame ? (
          <div
            data-dfx="badge"
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: 9,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            <span>{item.isCustomPutaway ? "🖼️ NEW" : "🖼️ FRAME"}</span>
          </div>
        ) : null}
        {!isSoldOut && isOos && (
          <div style={S.oosBadgeOverlay}>
            <span>UNAVAILABLE</span>
          </div>
        )}
      </div>

      <div style={S.productDetailsCol}>
        <h3 style={{ ...S.productName, color: "var(--ios-label)" }}>{item.name || "Catalog Item"}</h3>
        <div style={{ ...S.productWeight, color: "var(--ios-label-2)" }}>
          {item.weight || "1 pack"} •{" "}
          <b style={{ color: availableUnits <= 0 ? "#FF3B30" : "#34C759" }}>
            {availableUnits <= 0 ? "Sold out" : `${availableUnits} left`}
          </b>
        </div>

        <div style={S.productActionRow}>
          <div>
            {item.comingSoon ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FF9500" }}>Soon</span>
            ) : (
              <>
                <span style={{ ...S.productFinalPrice, color: "var(--ios-label)" }}>
                  ₹{safePrice}
                </span>
                {safeMrp > safePrice && (
                  <span style={S.productMrpStrike}>₹{safeMrp}</span>
                )}
              </>
            )}
          </div>

          {item.comingSoon ? (
            <button
              type="button"
              style={{
                background: "rgba(255,149,0,0.12)",
                border: "0.5px solid rgba(255,149,0,0.4)",
                color: "#FF9500",
                padding: "5px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={onOpenComingSoon}
            >
              Soon
            </button>
          ) : isSoldOut || isOos ? (
            <button style={S.productOosBtn} disabled title="Currently unavailable">
              {isSoldOut ? "Sold out" : "Unavailable"}
            </button>
          ) : (
            <IOSStepper
              compact
              value={qty}
              addLabel="ADD"
              disabled={qty >= availableUnits}
              onIncrement={() => {
                if (!isStoreOpen) {
                  onStoreClosedToast();
                  return;
                }
                onUpdateQty(item.sku, 1);
              }}
              onDecrement={() => onUpdateQty(item.sku, -1)}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default function OrderingAppPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Core Data
  const [authChecked, setAuthChecked] = useState(false);
  const [capacityBlockedMsg, setCapacityBlockedMsg] = useState("");
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const cartRef = useRef({});
  const [selectedCategory, setSelectedCategory] = useState("Chocolates");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(50);
  const gridLoadMoreRef = useRef(null);
  const searchInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [cartNotice, setCartNotice] = useState("");
  const [unconfirmedOrderPrompt, setUnconfirmedOrderPrompt] = useState(null);
  const checkoutStateHydratedRef = useRef(false);
  const pendingCheckoutIdemRef = useRef("");
  const cartPriceSnapshotRef = useRef({});
  const toastTimerRef = useRef(null);
  const stageDelayTimerRef = useRef(null);
  const navTimerRef = useRef(null);

  // Debounce search inputs by 250ms to prevent frame drops while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutStatusMsg, setCheckoutStatusMsg] = useState("");
  const [activeReservation, setActiveReservation] = useState(null); // { reservationId, idempotencyKey, expiresAtMs }
  const [reservationSecsLeft, setReservationSecsLeft] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const [oosList, setOosList] = useState([]);
  const [inventoryStockMap, setInventoryStockMap] = useState({});
  const [customCatalogItems, setCustomCatalogItems] = useState([]);
  const [isStoreOpen, setIsStoreOpen] = useState(true); // Store Manager Bhaskar N S toggle state
  const prevStoreOpenRef = useRef(true);

  // Blinkit Cart & Checkout Flow State
  const [isCheckoutView, setIsCheckoutView] = useState(false); // Can view either Catalog or pure Checkout
  const [activeBottomTab, setActiveBottomTab] = useState("home"); // 'home' | 'categories' | 'search' | 'order_again' | 'explore_tiptur'

  // Reset virtual window size when filter changes
  useEffect(() => {
    setVisibleLimit(50);
  }, [selectedCategory, debouncedSearchQuery, activeBottomTab]);
  const [selectedAddress, setSelectedAddress] = useState(SAVED_ADDRESSES[0]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState(["avoid_bell", "leave_door"]);
  const [appliedCoupon, setAppliedCoupon] = useState(AVAILABLE_COUPONS[0]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("wallet"); // 'wallet' | 'upi' | 'card' | 'cod'
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay"); // 'gpay' | 'phonepe' | 'paytm' | 'cred'
  const [ganeshaLang, setGaneshaLang] = useState("english"); // 'english' | 'kannada' | 'hindi'
  const [bgVideoIdx, setBgVideoIdx] = useState(0);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [activeDeliveryOrder, setActiveDeliveryOrder] = useState(null);
  const [dismissDeliveryBar, setDismissDeliveryBar] = useState(false);
  const [pastOrders, setPastOrders] = useState([]);
  useEffect(() => {
    const rawSaved = safeStorage.getJson("auditx_customer", null);
    const email = String(rawSaved?.email || "").toLowerCase().trim();
    if (email) {
      const allPast = safeArr(safeStorage.getJson(`auditx_past_orders_${email}`, safeStorage.getJson("auditx_customer_past_orders", [])));
      const filtered = allPast.filter((o) => {
        const oEmail = String(o?.customerEmail || o?.email || "").toLowerCase().trim();
        return !oEmail || oEmail === email;
      });
      setPastOrders(filtered);
    } else {
      setPastOrders([]);
    }
  }, []);

  // Hydrate persisted cart, address, coupon, instructions, payment method, and checkout step cleanly on load
  useEffect(() => {
    const savedCart = safeStorage.getJson("auditx_ordering_cart", null);
    if (savedCart && typeof savedCart === "object" && !Array.isArray(savedCart)) {
      const sanitizedCart = {};
      Object.entries(savedCart).forEach(([k, q]) => {
        const cleanQty = Math.floor(safeNum(q, 0));
        if (k && cleanQty > 0) sanitizedCart[k] = cleanQty;
      });
      setCart(sanitizedCart);
      cartRef.current = sanitizedCart;
    }
    const savedPriceMap = safeStorage.getJson("auditx_ordering_cart_prices", null);
    if (savedPriceMap && typeof savedPriceMap === "object" && !Array.isArray(savedPriceMap)) {
      cartPriceSnapshotRef.current = savedPriceMap;
    }
    const savedAddr = safeStorage.getJson("auditx_ordering_address", null);
    if (savedAddr && typeof savedAddr === "object" && savedAddr.address) {
      setSelectedAddress(savedAddr);
    }
    const savedCoupon = safeStorage.getJson("auditx_ordering_coupon", undefined);
    if (savedCoupon === null || (savedCoupon && typeof savedCoupon === "object" && savedCoupon.code)) {
      if (savedCoupon !== undefined) setAppliedCoupon(savedCoupon);
    }
    const savedIns = safeStorage.getJson("auditx_ordering_instructions", null);
    if (Array.isArray(savedIns)) {
      setSelectedInstructions(savedIns);
    }
    const savedPay = safeStorage.get("auditx_ordering_payment_method", "");
    if (savedPay && ["wallet", "upi", "card", "cod"].includes(savedPay)) {
      setSelectedPaymentMethod(savedPay);
    }
    const savedStep = safeStorage.getJson("auditx_ordering_checkout_step", null);
    const hasSavedCartItems = Object.keys(safeStorage.getJson("auditx_ordering_cart", {}) || {}).length > 0;
    if (savedStep && typeof savedStep === "object") {
      if (typeof savedStep.isCheckoutView === "boolean") setIsCheckoutView(hasSavedCartItems ? savedStep.isCheckoutView : false);
      if (typeof savedStep.activeBottomTab === "string") setActiveBottomTab(savedStep.activeBottomTab);
    }
    if (pathname) {
      if (pathname.endsWith("/cart") || pathname.endsWith("/checkout")) setIsCheckoutView(hasSavedCartItems);
      else if (pathname.endsWith("/categories")) { setIsCheckoutView(false); setActiveBottomTab("categories"); }
      else if (pathname.endsWith("/search")) { setIsCheckoutView(false); setActiveBottomTab("search"); }
      else if (pathname.endsWith("/orders")) { setIsCheckoutView(false); setActiveBottomTab("order_again"); }
    }
    checkoutStateHydratedRef.current = true;
  }, [pathname]);

  // Keep cartRef and safeStorage synchronized on every change
  useEffect(() => {
    cartRef.current = cart;
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.setJson("auditx_ordering_cart", cart);
  }, [cart]);

  useEffect(() => {
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.setJson("auditx_ordering_address", selectedAddress);
  }, [selectedAddress]);

  useEffect(() => {
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.setJson("auditx_ordering_coupon", appliedCoupon);
  }, [appliedCoupon]);

  useEffect(() => {
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.setJson("auditx_ordering_instructions", selectedInstructions);
  }, [selectedInstructions]);

  useEffect(() => {
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.set("auditx_ordering_payment_method", selectedPaymentMethod);
  }, [selectedPaymentMethod]);

  useEffect(() => {
    if (!checkoutStateHydratedRef.current) return;
    safeStorage.setJson("auditx_ordering_checkout_step", { isCheckoutView, activeBottomTab });
  }, [isCheckoutView, activeBottomTab]);
  const [orderingStage, setOrderingStage] = useState("idle"); // 'idle' | 'picking' | 'packed_assigning' | 'rider_assigned' | 'almost_doorstep' | 'rider_arrived' | 'delivered'
  const [deliveryCountdownSec, setDeliveryCountdownSec] = useState(600); // 10 minutes = 600 seconds total SLA (2m OD Picker + 8m Rider)
  const [pickerDelayMins, setPickerDelayMins] = useState(0); // Dynamic picking delay from OD Picker Thrupthi K S
  const [customFloatingTitle, setCustomFloatingTitle] = useState("");
  const [customFloatingSub, setCustomFloatingSub] = useState("");
  const [customFloatingBadge, setCustomFloatingBadge] = useState("");
  const [orderingDoorstepSec, setOrderingDoorstepSec] = useState(15);
  const [showRateOrderModal, setShowRateOrderModal] = useState(false);
  const [riderStars, setRiderStars] = useState(5);
  const [itemStarsMap, setItemStarsMap] = useState({});
  const [rateFeedbackText, setRateFeedbackText] = useState("");
  const [rateCompleted, setRateCompleted] = useState(false);
  const [placedOrderAnimation, setPlacedOrderAnimation] = useState(null);
  const playedOrderPlacedIds = useRef(new Set());
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [latestDeliveredSlipOrder, setLatestDeliveredSlipOrder] = useState(null);

  const syncPastOrdersWithLive = useCallback((ordersList) => {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return;
    try {
      const liveById = new Map();
      ordersList.forEach((o) => {
        if (!o) return;
        const k1 = String(o.id || "");
        const k2 = String(o.orderId || "");
        const k3 = String(o.orderNumber || "");
        if (k1) liveById.set(k1, o);
        if (k2) liveById.set(k2, o);
        if (k3) liveById.set(k3, o);
      });
      const currentCust = safeStorage.getJson("auditx_customer", null);
      const email = String(currentCust?.email || "").toLowerCase().trim();
      const pastOrdersKey = email ? `auditx_past_orders_${email}` : "auditx_customer_past_orders";
      const existing = safeArr(safeStorage.getJson(pastOrdersKey, safeStorage.getJson("auditx_customer_past_orders", [])));
      let changed = false;
      const merged = existing.map((po) => {
        const match =
          liveById.get(String(po.id || "")) ||
          liveById.get(String(po.orderNumber || "")) ||
          liveById.get(String(po.orderId || ""));
        if (!match) return po;
        const nextStatus = match.status || po.status || "pending";
        const nextDeliveredAt = match.deliveredAt || po.deliveredAt || null;
        if (
          nextStatus !== po.status ||
          nextDeliveredAt !== (po.deliveredAt || null) ||
          (!po.paymentMethod && match.paymentMethod)
        ) {
          changed = true;
          return {
            ...po,
            status: nextStatus,
            deliveredAt: nextDeliveredAt || po.deliveredAt,
            deliveryDurationSec: match.deliveryDurationSec || po.deliveryDurationSec,
            pickTimeSec: match.pickTimeSec || po.pickTimeSec,
            pickerName: match.pickerName || po.pickerName,
            captainName: match.captainName || po.captainName,
            paymentMethod: match.paymentMethod || po.paymentMethod,
            customerName: match.customerName || po.customerName,
            customerEmail: match.customerEmail || po.customerEmail || email,
            customerPhone: match.customerPhone || po.customerPhone,
            customerAddress: match.customerAddress || po.customerAddress,
            totalAmount: match.totalAmount ?? po.totalAmount ?? po.total,
          };
        }
        return po;
      });
      if (changed) {
        if (email) safeStorage.setJson(pastOrdersKey, merged);
        safeStorage.setJson("auditx_customer_past_orders", merged);
        setPastOrders(merged.filter((p) => {
          const pEmail = String(p?.customerEmail || p?.email || "").toLowerCase().trim();
          return !pEmail || !email || pEmail === email;
        }));
      }

      const last = safeStorage.getJson("auditx_customer_last_order", null);
      const lastEmail = String(last?.customerEmail || last?.email || "").toLowerCase().trim();
      if (last && typeof last === "object" && (!lastEmail || !email || lastEmail === email)) {
        const lastKey = String(last.id || last.orderId || last.orderNumber || "");
        const liveLast = liveById.get(lastKey) || last;
        const lastSt = String(liveLast?.status || "").toLowerCase();
        const dismissedSlip = String(safeStorage.get("auditx_dismissed_slip_banner", "") || "");
        if (lastSt === "delivered" && lastKey && dismissedSlip !== lastKey) {
          setLatestDeliveredSlipOrder(liveLast);
        } else if (lastSt && lastSt !== "delivered") {
          setLatestDeliveredSlipOrder(null);
        }
      }
    } catch { }
  }, []);

  // Modal & Overlay visibility state (declared prior to isOrderingHomeActive TDZ guard)
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Fullscreen Opening Intro Video Splash (plays once strictly after Google Auth login)
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);

  const isOrderingHomeActive = Boolean(
    authChecked &&
    customer &&
    !capacityBlockedMsg &&
    !showIntroOverlay &&
    !placedOrderAnimation &&
    !isCheckoutView &&
    !showProfileModal &&
    !showLoginModal &&
    !showPaymentModal &&
    !showComplaintModal &&
    activeBottomTab === "home"
  );

  // Festive crackers & Diwali theme active strictly on Ordering App Home page (plays right after team intro)
  useEffect(() => {
    if (!isOrderingHomeActive) {
      DiwaliCrackers.unmount();
      DiwaliTheme.unmount();
      return;
    }

    const timer = setTimeout(() => {
      DiwaliTheme.mount({
        root: "#ax-ordering-shell",
        ground: 58,
        mode: "light",
        sound: true,
        ambient: false,
        once: true,
      });
      DiwaliCrackers.mount({
        root: "#ax-ordering-shell",
        ground: 68,
        scale: 0.6,
        sound: true,
        loop: true,
        delayMs: 300,
      });
    }, 80);
    return () => {
      clearTimeout(timer);
      DiwaliCrackers.unmount();
      DiwaliTheme.unmount();
    };
  }, [isOrderingHomeActive]);
  const [introFadeOut, setIntroFadeOut] = useState(false);
  const introVideoRef = useRef(null);
  const introCompletedRef = useRef(false);
  const introHasStartedRef = useRef(false);
  const introLastTickAtRef = useRef(Date.now());
  const introFadeTimerRef = useRef(null);

  function triggerTeamIntroOnce() {
    safeStorage.remove("auditx_play_team_intro_once", "session");
    safeStorage.remove("auditx_play_team_intro_once", "local");
    if (introFadeTimerRef.current) {
      clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }
    introCompletedRef.current = false;
    introHasStartedRef.current = false;
    introLastTickAtRef.current = Date.now();
    setIntroFadeOut(false);
    setShowIntroOverlay(true);
  }

  function finishIntroSplash(immediate = false) {
    if (introCompletedRef.current) return;
    introCompletedRef.current = true;
    if (immediate) {
      setShowIntroOverlay(false);
      return;
    }
    setIntroFadeOut(true);
    introFadeTimerRef.current = setTimeout(() => {
      setShowIntroOverlay(false);
    }, 550);
  }

  useEffect(() => {
    if (!authChecked || !showIntroOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [authChecked, showIntroOverlay]);

  useEffect(() => {
    if (!authChecked || !showIntroOverlay) return;
    const vid = introVideoRef.current;
    if (!vid) return;

    introLastTickAtRef.current = Date.now();
    // Sound strictly OFF
    vid.muted = true;
    vid.defaultMuted = true;
    vid.volume = 0;
    vid.playbackRate = 1.0;

    const playPromise = vid.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        if (err && err.name === "NotAllowedError") {
          finishIntroSplash(false);
        }
      });
    }

    // Safety guard only: never cuts off exact video timeline; handles initial load stall (> 8s) or mid-stream stall (> 4.5s)
    const stallCheck = setInterval(() => {
      if (introCompletedRef.current) return;
      const idleMs = Date.now() - introLastTickAtRef.current;
      const limitMs = introHasStartedRef.current ? 4500 : 8000;
      if (idleMs > limitMs) {
        finishIntroSplash(false);
      }
    }, 1500);

    return () => {
      clearInterval(stallCheck);
      if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
    };
  }, [authChecked, showIntroOverlay]);

  // Customer Complaint System (Synced with SM Bhaskar N S & ASM Deepu B Dashboard)
  const [complaintsTab, setComplaintsTab] = useState("tickets"); // "raise" | "tickets"
  const [complaintOrderId, setComplaintOrderId] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("Missing Item");
  const [complaintText, setComplaintText] = useState("");
  const [complaintRefundAmount, setComplaintRefundAmount] = useState("");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [customerComplaints, setCustomerComplaints] = useState([]);

  // Profile & Customer Login State
  const [loginStep, setLoginStep] = useState("phone"); // 'phone' | 'otp' | 'name'
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginDemoOtp, setLoginDemoOtp] = useState("442201");

  // Network online/offline tracking + automatic price/stock refetch upon reconnect
  useEffect(() => {
    let wasOnline = isOnlineNow();
    setIsOnline(wasOnline);
    return subscribeNetworkStatus((snap) => {
      setIsOnline(snap.online);
      if (!wasOnline && snap.online) {
        triggerToast("Back online — refreshing live catalog prices & stock...");
        fetchCloudHubState({ force: true }).catch(() => { });
      }
      wasOnline = snap.online;
    });
  }, []);

  // Checkout active indicator (prevents SW reload mid-checkout) + unload guard during payment submission
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.auditxCheckoutActive = isCheckoutView || showPaymentModal ? "1" : "0";
    }
    const handleBeforeUnload = (e) => {
      if (placingOrder) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (typeof document !== "undefined") {
        document.body.dataset.auditxCheckoutActive = "0";
      }
    };
  }, [isCheckoutView, showPaymentModal, placingOrder]);

  // Idle route/component prefetch when auth is settled
  useEffect(() => {
    if (!authChecked) return;
    const prefetchHeavy = () => {
      try {
        import("@/components/ui/OrderPlacedSheet");
      } catch { }
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchHeavy, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const tid = setTimeout(prefetchHeavy, 1500);
    return () => clearTimeout(tid);
  }, [authChecked]);

  // Load Customer (Mandatory Google Login Gate preserving returnTo path & cart across session expiry)
  useEffect(() => {
    const rawSaved =
      safeStorage.getJson("auditx_customer", null) ||
      safeStorage.getJson("blinkit_customer", null);
    const parsedCustomer = validateCustomerBoundary(rawSaved);

    if (!parsedCustomer || !parsedCustomer.email || parsedCustomer.customerId === "cust_tiptur_demo") {
      const returnPath = typeof window !== "undefined" ? window.location.pathname || "/ordering" : "/ordering";
      safeStorage.set("auditx_auth_return_to", returnPath, "session");
      router.replace(`/ordering/login?returnTo=${encodeURIComponent(returnPath)}`);
      return;
    }

    parsedCustomer.location = "KFGSC , Tiptur 572201";
    setCustomer(parsedCustomer);
    setAuthChecked(true);

    const customerEmail = String(parsedCustomer.email || "").toLowerCase().trim();
    const prevEmail = String(safeStorage.get("auditx_current_customer_email", "") || "").toLowerCase().trim();
    const isDifferentAccount = prevEmail && prevEmail !== customerEmail;

    if (isDifferentAccount) {
      // Switched to a different Google account: clean wipe previous orders, cart and animation state
      safeStorage.remove("auditx_customer_last_order");
      safeStorage.remove("auditx_ordering_cart");
      safeStorage.remove("auditx_ordering_cart_prices");
      safeStorage.remove("auditx_ordering_checkout_step");
      safeStorage.remove("auditx_dismissed_track_order");
      safeStorage.remove("auditx_dismissed_slip_banner");
      safeStorage.remove("dfx-seen", "session");
      safeStorage.remove("dfx-seen", "local");
      try {
        sessionStorage.removeItem("dfx-seen");
        localStorage.removeItem("dfx-seen");
      } catch {}

      setCart({});
      cartRef.current = {};
      cartPriceSnapshotRef.current = {};
      setActiveDeliveryOrder(null);
      setLatestDeliveredSlipOrder(null);
      setIsCheckoutView(false);
      setActiveBottomTab("home");

      // Load only this customer's past orders
      const custOrders = safeArr(safeStorage.getJson(`auditx_past_orders_${customerEmail}`, [])).filter((o) => {
        const oEmail = String(o?.customerEmail || o?.email || "").toLowerCase().trim();
        return !oEmail || oEmail === customerEmail;
      });
      setPastOrders(custOrders);

      // Trigger team intro animation fresh on login
      triggerTeamIntroOnce();
    } else {
      // Load this customer's past orders
      const custOrders = safeArr(
        safeStorage.getJson(`auditx_past_orders_${customerEmail}`, safeStorage.getJson("auditx_customer_past_orders", []))
      ).filter((o) => {
        const oEmail = String(o?.customerEmail || o?.email || "").toLowerCase().trim();
        return !oEmail || oEmail === customerEmail;
      });
      setPastOrders(custOrders);
    }
    safeStorage.set("auditx_current_customer_email", customerEmail);

    const pendingIntro =
      safeStorage.get("auditx_play_team_intro_once", "", "session") === "1" ||
      safeStorage.get("auditx_play_team_intro_once", "", "local") === "1";
    if (pendingIntro) {
      triggerTeamIntroOnce();
    }

    // Non-blocking customer device login sync (unlimited capacity)
    dispatchCloudAction("REGISTER_LOGIN", {
      deviceUid: getOrCreateDeviceUid(),
      name: parsedCustomer.name,
      phone: parsedCustomer.phone || "",
      email: parsedCustomer.email || "",
      loginMethod: parsedCustomer.loginMethod || "Saved Session",
    }).catch(() => { });

    setOosList(safeArr(safeStorage.getJson("auditx_oos_items", [])));
    const rawInv = safeStorage.getJson("auditx_inventory_units", {});
    if (rawInv && typeof rawInv === "object" && !Array.isArray(rawInv)) setInventoryStockMap(rawInv);
    setCustomCatalogItems(safeArr(safeStorage.getJson("auditx_custom_catalog", [])));
    const openNow = safeStorage.get("auditx_store_open", "true") !== "false";
    setIsStoreOpen(openNow);
    prevStoreOpenRef.current = openNow;

    function checkActiveDelivery(ordersOverride = null) {
      try {
        const liveOrders = safeArr(Array.isArray(ordersOverride) ? ordersOverride : getAllLiveOrders());
        if (liveOrders.length > 0) {
          syncPastOrdersWithLive(liveOrders);
        }
        if (liveOrders.length === 0) {
          setActiveDeliveryOrder(null);
          return;
        }
        const last = safeStorage.getJson("auditx_customer_last_order", null);
        const lastEmail = String(last?.customerEmail || last?.email || "").toLowerCase().trim();
        let active = null;
        if (last && typeof last === "object" && (!lastEmail || lastEmail === customerEmail)) {
          const live = liveOrders.find((o) => o && (o.id || o.orderId) === (last.id || last.orderId));
          active = live || (!["cancelled", "delivered"].includes(String(last.status || "").toLowerCase()) ? last : null);
        }
        const dismissedOrderId = String(safeStorage.get("auditx_dismissed_track_order", "") || "");
        const activeId = String(active?.id || active?.orderId || active?.orderNumber || "");
        const activeSt = String(active?.status || "").toLowerCase();
        if (
          active &&
          activeSt !== "cancelled" &&
          activeSt !== "delivered" &&
          activeSt !== "arrived" &&
          activeSt !== "rider_arrived" &&
          !active.trackingDismissed &&
          (!dismissedOrderId || dismissedOrderId !== activeId)
        ) {
          if (safeNum(active.delayMins, 0) > 0) {
            setPickerDelayMins(safeNum(active.delayMins, 0));
          }
          if (
            activeSt === "staged" ||
            activeSt === "picked" ||
            activeSt === "dispatched" ||
            activeSt === "en_route" ||
            active.handoverToRiderCompleted
          ) {
            setActiveDeliveryOrder(active);
            setOrderingStage((prev) =>
              prev === "idle" || prev === "picking" ? "rider_assigned" : prev
            );
            setDeliveryCountdownSec((prev) => (prev > 480 ? 480 : prev));
          } else {
            setActiveDeliveryOrder(active);
            setOrderingStage((prev) => (prev === "idle" ? "picking" : prev));
          }
        } else {
          setShowRateOrderModal(false);
          setActiveDeliveryOrder(null);
          setOrderingStage("idle");
          setPickerDelayMins(0);
        }
      } catch (err) {
        console.warn("Check active delivery error:", err);
      }
    }

    const onFocusCheck = () => checkActiveDelivery();
    checkActiveDelivery();
    window.addEventListener("focus", onFocusCheck);

    function loadComplaints() {
      try {
        setCustomerComplaints(safeArr(getAllLiveComplaints()));
      } catch {
        setCustomerComplaints([]);
      }
    }
    loadComplaints();

    // Cross-device real-time cloud hub & <1s SSE subscription (syncs SM/ASM edits -> phones)
    const unsubCloud = subscribeToCloudHub((cloudState, meta) => {
      if (!cloudState) return;
      const cloudOpen = cloudState.isStoreOpen !== false;
      if (!meta?.fromCache && prevStoreOpenRef.current !== cloudOpen) {
        if (!cloudOpen) {
          playNotificationChime();
          triggerToast("🛑 Oops! Your Store is now closed , opening soon");
        } else {
          playSuccessChime();
          triggerToast("🟢 Store is now OPEN! Bhaskar N S has opened the store for ordering.");
        }
      }
      prevStoreOpenRef.current = cloudOpen;
      setIsStoreOpen(cloudOpen);

      if (Array.isArray(cloudState.oosList)) {
        setOosList(cloudState.oosList);
      }
      if (cloudState.inventoryStockMap && typeof cloudState.inventoryStockMap === "object" && !Array.isArray(cloudState.inventoryStockMap)) {
        setInventoryStockMap(cloudState.inventoryStockMap);
      }
      if (Array.isArray(cloudState.customCatalogItems)) {
        setCustomCatalogItems(cloudState.customCatalogItems);
      }
      if (Array.isArray(cloudState.complaints)) {
        setCustomerComplaints(sanitizeComplaints(cloudState.complaints));
      }
      if (Array.isArray(cloudState.orders)) {
        checkActiveDelivery(cloudState.orders);
      }
    }, 1800, { scope: "customer", storeId: "TIPTUR-HUB-KA44" });

    const unsubBus = subscribeToEvents((data) => {
      if (!data) return;
      if (data.type === "STORE_STATUS_CHANGED" && data.payload) {
        const nextOpen = data.payload.isOpen !== false;
        prevStoreOpenRef.current = nextOpen;
        setIsStoreOpen(nextOpen);
        if (!nextOpen) {
          playNotificationChime();
          triggerToast("🛑 Oops! Your Store is now closed , opening soon");
        } else {
          playSuccessChime();
          triggerToast("🟢 Store is now OPEN! Bhaskar N S has opened the store for ordering.");
        }
      }
      if (data.type === "ITEM_STOCK_TOGGLED" && data.payload) {
        const pSku = data.payload.sku;
        const pInStock = Boolean(data.payload.inStock);
        const pUnits = Number.isFinite(Number(data.payload.units))
          ? Number(data.payload.units)
          : data.payload.inventoryStockMapPatch?.[pSku] !== undefined
          ? Number(data.payload.inventoryStockMapPatch[pSku])
          : pInStock
          ? (String(pSku).startsWith("FRAME-") ? 1 : 5)
          : 0;

        if (!pInStock) {
          setOosList((prev) => [...new Set([...prev, pSku])]);
          setInventoryStockMap((prev) => ({ ...prev, [pSku]: 0 }));
          triggerToast(`Stock Alert: "${data.payload.name || pSku}" marked Out of Stock.`);
        } else {
          const restoredUnits = Math.max(1, pUnits);
          setOosList((prev) => prev.filter((s) => s !== pSku));
          setInventoryStockMap((prev) => ({ ...prev, [pSku]: restoredUnits }));
          playSuccessChime();
          triggerToast(`🟢 "${data.payload.name || pSku}" is restored! (${restoredUnits} unit${restoredUnits > 1 ? "s" : ""} available to order)`);
        }
      }
      if (data.type === "PUTAWAY_ITEM_ADDED" && data.payload) {
        const newItem = data.payload.item;
        const allCustoms = Array.isArray(data.payload.customCatalogItems)
          ? data.payload.customCatalogItems
          : newItem
          ? [newItem, ...customCatalogItems.filter((c) => c.sku !== newItem.sku)]
          : null;
        if (allCustoms) {
          setCustomCatalogItems(allCustoms);
          try {
            localStorage.setItem("auditx_custom_catalog", JSON.stringify(allCustoms));
          } catch {}
        }
        if (newItem?.sku && Number.isFinite(Number(data.payload.units || newItem.units))) {
          const u = Number(data.payload.units || newItem.units);
          setInventoryStockMap((prev) => ({ ...prev, [newItem.sku]: u }));
          setOosList((prev) => prev.filter((s) => s !== newItem.sku));
        }
        playSuccessChime();
        triggerToast(`✨ Fresh Arrival! "${newItem?.name || "New Item"}" was just added and is live to order!`);
      }
      if (data.type === "PUTAWAY_ITEM_REMOVED" && data.payload?.sku) {
        setCustomCatalogItems((prev) => {
          const nextArr = prev.filter((c) => c.sku !== data.payload.sku);
          try {
            localStorage.setItem("auditx_custom_catalog", JSON.stringify(nextArr));
          } catch {}
          return nextArr;
        });
      }
      if (
        (data.type === "STOCK_DELTA" ||
          data.type === "ORDER_PLACED_STOCK_DELTA" ||
          data.type === "STOCK_RESET" ||
          data.type === "STOCK_UPDATE") &&
        (data.payload || data)
      ) {
        const payload = data.payload || data;
        if (Array.isArray(payload.oosList)) {
          setOosList(payload.oosList);
        }
        if (payload.inventoryStockMapPatch && typeof payload.inventoryStockMapPatch === "object") {
          setInventoryStockMap((prev) => ({
            ...prev,
            ...payload.inventoryStockMapPatch,
          }));
        }
        if (payload.inventoryStockMap && typeof payload.inventoryStockMap === "object") {
          setInventoryStockMap(payload.inventoryStockMap);
        }
      }
      if (data.type === "ORDER_CREATED" && data.payload?.items) {
        setInventoryStockMap((prev) => {
          const updated = { ...prev };
          const newlyOos = [];
          for (const it of data.payload.items) {
            const sku = it.sku || it.skuId;
            if (sku) {
              const cur = Number(updated[sku] ?? getDefaultItemStock(it));
              const rem = Math.max(0, cur - Number(it.qty || it.quantity || 1));
              updated[sku] = rem;
              if (rem <= 0) newlyOos.push(sku);
            }
          }
          if (newlyOos.length > 0) {
            setOosList((prevOos) => Array.from(new Set([...prevOos, ...newlyOos])));
          }
          return updated;
        });
      }
      if (data.type === "PICKER_DELAY_UPDATED") {
        const p = data.payload || data;
        const delayM = safeNum(p.delayMins, p.delaySec ? Math.ceil(safeNum(p.delaySec, 0) / 60) : 0);
        setPickerDelayMins(delayM);
        const dynamicSec = 480 + (safeNum(p.delaySec, 0) || delayM * 60);
        setDeliveryCountdownSec(dynamicSec);
        setCustomFloatingTitle(`Arriving in ${10 + delayM} mins`);
        setCustomFloatingSub(`Picking is taking slightly longer (+${delayM} min)`);
      }
      if (
        data.type === "ORDER_CREATED" ||
        data.type === "ORDER_STATUS_CHANGED" ||
        data.type === "ORDER_ASSIGNED" ||
        data.type === "ORDER_PICKED" ||
        data.type === "ORDER_STAGED" ||
        data.type === "PICKER_HANDOVER_COMPLETED" ||
        data.type === "FAST_DELIVERY_STARTED" ||
        data.type === "ORDER_DELIVERED"
      ) {
        checkActiveDelivery();
        if (
          data.type === "ORDER_STAGED" ||
          data.type === "PICKER_HANDOVER_COMPLETED"
        ) {
          const p = data.payload || data;
          if (p.delayMins !== undefined) setPickerDelayMins(safeNum(p.delayMins, 0));
          setOrderingStage("packed_assigning");
          setCustomFloatingTitle("Order packed");
          setCustomFloatingSub("Assigning rider");
          setCustomFloatingBadge("Packed");
          playNotificationChime();
          triggerToast("Order packed! Assigning rider soon.");

          if (stageDelayTimerRef.current) clearTimeout(stageDelayTimerRef.current);
          stageDelayTimerRef.current = setTimeout(() => {
            setOrderingStage("rider_assigned");
            setDeliveryCountdownSec(480);
            setCustomFloatingTitle("On the way");
            setCustomFloatingSub("Delivery Partner is heading to you");
            setCustomFloatingBadge("");
            playNotificationChime();
            triggerToast("Delivery Partner is on the way (8 mins)");
          }, 2500);
        } else if (data.type === "FAST_DELIVERY_STARTED") {
          setOrderingStage("rider_assigned");
          setDeliveryCountdownSec(480);
          setCustomFloatingTitle("On the way");
          setCustomFloatingSub("Delivery Partner is heading to you");
          setCustomFloatingBadge("");
        }
        if (data.type === "ORDER_DELIVERED") {
          const ordId = String(
            data.payload?.id || data.payload?.orderId || data.payload?.orderNumber || ""
          );
          if (ordId) safeStorage.set("auditx_dismissed_track_order", ordId);
          if (data.payload) {
            const deliveredObj = {
              ...data.payload,
              status: "delivered",
              deliveredAt: data.payload.deliveredAt || new Date().toISOString(),
            };
            syncPastOrdersWithLive([deliveredObj]);
            const dismissedSlip = String(safeStorage.get("auditx_dismissed_slip_banner", "") || "");
            if (!ordId || dismissedSlip !== ordId) {
              setLatestDeliveredSlipOrder(deliveredObj);
            }
          }
          setRateCompleted(false);
          setShowRateOrderModal(false);
          setDismissDeliveryBar(true);
          setActiveDeliveryOrder(null);
          setOrderingStage("idle");
          setPickerDelayMins(0);
          playSuccessChime();
          triggerToast("🎉 Order arrived at your doorstep!");
        }
      }
      if (data.type === "ORDER_RATED") {
        setRateCompleted(true);
        setShowRateOrderModal(false);
        setActiveDeliveryOrder(null);
        setOrderingStage("idle");
        setPickerDelayMins(0);
      }
      if (data.type === "QUEUE_CLEARED") {
        setActiveDeliveryOrder(null);
        setOrderingStage("idle");
        setPickerDelayMins(0);
        setCustomerComplaints([]);
        triggerToast("🧹 Today's dispatch queue cleared across all apps!");
      }
      if (data.type === "COMPLAINT_RESOLVED") {
        loadComplaints();
        playSuccessChime();
        triggerToast(`🔔 Complaint #${data.payload?.id || ""} resolved by ${data.payload?.resolvedBy || "Store Manager"}!`);
      }
      if (data.type === "CUSTOMER_COMPLAINT_FILED" || data.type === "COMPLAINT_RAISED") {
        loadComplaints();
      }
    });

    const handleStorageEvent = (e) => {
      if (e.key === "auditx_store_open") {
        setIsStoreOpen(e.newValue !== "false");
      }
      if (e.key === "auditx_complaints") {
        loadComplaints();
      }
      if (e.key === "auditx_oos_items" && e.newValue) {
        setOosList(safeArr(safeStorage.getJson("auditx_oos_items", [])));
      }
      if (e.key === "auditx_inventory_units" && e.newValue) {
        const parsed = safeStorage.getJson("auditx_inventory_units", {});
        if (parsed && typeof parsed === "object") setInventoryStockMap(parsed);
      }
      if (e.key === "auditx_custom_catalog" && e.newValue) {
        setCustomCatalogItems(safeArr(safeStorage.getJson("auditx_custom_catalog", [])));
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    const timer = setTimeout(() => setLoading(false), 160);
    return () => {
      clearTimeout(timer);
      if (stageDelayTimerRef.current) clearTimeout(stageDelayTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      unsubCloud();
      unsubBus();
      window.removeEventListener("focus", onFocusCheck);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [router]);

  // Synchronized SLA Countdown Progression (pure interval, zero side effects inside functional state updater)
  const countdownSecRef = useRef(deliveryCountdownSec);
  countdownSecRef.current = deliveryCountdownSec;
  const activeDeliveryId = activeDeliveryOrder?.id || activeDeliveryOrder?.orderId || null;

  // Real-time Firestore onSnapshot listener for live order tracking without page reload
  useEffect(() => {
    if (!db || !activeDeliveryId) return;
    let unsubFs = null;
    try {
      unsubFs = onSnapshot(
        doc(db, "orders", String(activeDeliveryId)),
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            syncPastOrdersWithLive([data]);
            const st = String(data.status || "").toLowerCase();
            if (st === "delivered") {
              setOrderingStage("delivered");
              setDeliveryCountdownSec(0);
              setLatestDeliveredSlipOrder(data);
              setActiveDeliveryOrder(null);
            } else if (st === "dispatched" || st === "out_for_delivery") {
              setOrderingStage("rider_assigned");
            } else if (st === "packed" || st === "staged") {
              setOrderingStage("packed_assigning");
            }
          }
        },
        (err) => {
          console.warn("[OrderingPage] Firestore onSnapshot warning:", err?.message);
        }
      );
    } catch (e) {
      console.warn("[OrderingPage] Firestore listener init error:", e?.message);
    }
    return () => {
      if (unsubFs) unsubFs();
    };
  }, [activeDeliveryId, syncPastOrdersWithLive]);

  useEffect(() => {
    if (orderingStage === "idle" || orderingStage === "delivered" || !activeDeliveryId) return;

    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const cur = countdownSecRef.current;
      if (cur <= 1) {
        countdownSecRef.current = 0;
        setDeliveryCountdownSec(0);
        const ordId = String(
          activeDeliveryOrder?.id ||
          activeDeliveryOrder?.orderId ||
          activeDeliveryOrder?.orderNumber ||
          ""
        );
        if (ordId) safeStorage.set("auditx_dismissed_track_order", ordId);
        setActiveDeliveryOrder(null);
        setOrderingStage("idle");
        setShowRateOrderModal(false);
        setDismissDeliveryBar(true);
        playSuccessChime();
        triggerToast("🛵 Your order has arrived at your doorstep!");
        return;
      }
      const next = cur - 1;
      countdownSecRef.current = next;
      setDeliveryCountdownSec(next);
      if (next === 15 && orderingStage !== "almost_doorstep") {
        setOrderingStage("almost_doorstep");
        playNotificationChime();
        triggerToast("⚡ Almost to your doorstep! Delivery Partner is reaching now.");
      }
    }, 1000);

    return () => clearInterval(t);
  }, [orderingStage, activeDeliveryId]);

  function handleSubmitOrderingRating(e) {
    if (e) e.preventDefault();
    if (!activeDeliveryOrder) return;
    const ordId = activeDeliveryOrder.id || activeDeliveryOrder.orderId || activeDeliveryOrder.orderNumber;
    if (!ordId) return;
    withIdempotentLock(`rating_${ordId}`, async () => {
      playSuccessChime();
      const ratingPayload = {
        orderId: ordId,
        orderNumber: activeDeliveryOrder.orderNumber || ordId,
        customerName: customer?.name || activeDeliveryOrder.customerName || "Customer",
        riderRating: riderStars,
        itemRatings: itemStarsMap,
        comment: rateFeedbackText.trim(),
        ratedAt: new Date().toISOString(),
      };
      const prev = safeArr(safeStorage.getJson("auditx_customer_ratings", []));
      safeStorage.setJson("auditx_customer_ratings", [ratingPayload, ...prev.slice(0, 39)]);
      const deliveredOrder = {
        ...activeDeliveryOrder,
        status: "delivered",
        stage: "Delivered",
        deliveredAt: new Date().toISOString(),
        customerRatingSubmitted: true,
        riderRating: riderStars,
        itemRatings: itemStarsMap,
      };
      updateLiveOrder(ordId, deliveredOrder);
      dispatchCloudAction("SUBMIT_RATING", { ratingPayload });
      broadcastEvent("ORDER_DELIVERED", deliveredOrder);
      broadcastEvent("ORDER_RATED", ratingPayload);
      setRateCompleted(true);
      setShowRateOrderModal(false);
      setActiveDeliveryOrder(null);
      setOrderingStage("idle");
      triggerToast("🎉 Order Delivered & Verified! Thank you for your review.");
    });
  }

  function handleClearAllQueue() {
    playNotificationChime();
    clearAllLiveOrders();
    setActiveDeliveryOrder(null);
    triggerToast("🧹 Cleared Today's Queue across Warehouse, Picker, and Ordering Apps!");
  }

  async function handleFileComplaint(e) {
    if (e) e.preventDefault();
    if (!complaintText.trim()) {
      triggerToast("Please provide details about the issue with your order.");
      return;
    }
    await withIdempotentLock("file_complaint", async () => {
      setComplaintSubmitting(true);
      try {
        playNotificationChime();

        const ticketId = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
        const effectiveOrderId =
          complaintOrderId.trim() || activeDeliveryOrder?.id || activeDeliveryOrder?.orderNumber || "ORD-KA44-9042";

        const newComplaint = {
          id: ticketId,
          orderId: effectiveOrderId,
          customerName: customer?.name || "Customer (KFGSC Tiptur)",
          phone: customer?.phone || "9876543210",
          issue: complaintText.trim(),
          category: complaintCategory,
          severity: "HIGH",
          slaMins: 5,
          status: "OPEN",
          time: "Just now",
          createdAt: new Date().toISOString(),
          assignedTo: "Bhaskar N S (SM) / Deepu B (ASM)",
          amount: safeNum(complaintRefundAmount, 0),
          customerAddress: selectedAddress?.address || "KFGSC , Tiptur 572201",
        };

        const existing = safeArr(safeStorage.getJson("auditx_complaints", []));
        const updated = [newComplaint, ...existing.filter((c) => c.id !== ticketId)].slice(0, 50);
        safeStorage.setJson("auditx_complaints", updated);
        setCustomerComplaints(updated);

        await dispatchCloudAction("FILE_COMPLAINT", { complaint: newComplaint });
        broadcastEvent("CUSTOMER_COMPLAINT_FILED", newComplaint);
        broadcastEvent("COMPLAINT_RAISED", newComplaint);

        setComplaintText("");
        setComplaintRefundAmount("");
        setComplaintsTab("tickets");
        triggerToast(`⚠️ Complaint ticket ${ticketId} lodged! Store Manager Bhaskar N S & ASM Deepu B notified.`);
      } finally {
        setComplaintSubmitting(false);
      }
    });
  }

  function handleCheckStoreStatus() {
    playNotificationChime();
    const open = safeStorage.get("auditx_store_open", "true") !== "false";
    setIsStoreOpen(open);
    if (open) {
      triggerToast("🎉 Store is now OPEN! You can browse and place orders.");
    } else {
      triggerToast("⏳ Oops! Your Store is now closed , opening soon");
    }
  }

  function triggerToast(msg) {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3500);
  }

  // Merge standard catalog with ASM Putaway items: ONLY Chocolates & Frames in Ordering App
  const effectiveCatalog = useMemo(() => {
    return mergeCatalogItems(CATALOG, customCatalogItems).filter(
      (item) =>
        item &&
        typeof item === "object" &&
        Boolean(item.sku || item.id) &&
        Number.isFinite(Number(item.price)) &&
        (item.category === "Chocolates" || item.category === "Frames")
    );
  }, [customCatalogItems]);

  const getAvailableUnits = useCallback(
    (item) => {
      if (!item) return 0;
      const itemName = String(item.name || "").toLowerCase();
      if (item.soldOut || item.inStock === false || itemName.includes("pup") || isPuppyFrame(item)) {
        return 0;
      }
      if (oosList.includes(item.sku)) return 0;
      if (inventoryStockMap[item.sku] !== undefined && Number.isFinite(Number(inventoryStockMap[item.sku]))) {
        return Math.max(0, Math.floor(Number(inventoryStockMap[item.sku])));
      }
      if (item.isCustomPutaway && Number.isFinite(Number(item.units))) {
        return Math.max(0, Math.floor(Number(item.units)));
      }
      return getDefaultItemStock(item);
    },
    [oosList, inventoryStockMap]
  );

  // Reconcile persisted cart against live prices & stock whenever catalog/stock updates
  useEffect(() => {
    const entries = Object.entries(cartRef.current || {});
    if (entries.length === 0 || effectiveCatalog.length === 0) return;

    let changed = false;
    let removedOrClampedNames = [];
    let priceChangedNames = [];
    const nextCart = { ...cartRef.current };
    const nextPriceMap = { ...cartPriceSnapshotRef.current };

    for (const [sku, rawQty] of entries) {
      const product = effectiveCatalog.find((c) => c.sku === sku);
      const curQty = Math.floor(safeNum(rawQty, 0));
      if (!product || curQty <= 0) {
        delete nextCart[sku];
        changed = true;
        continue;
      }
      const avail = getAvailableUnits(product);
      if (avail <= 0 || oosList.includes(sku) || product.comingSoon) {
        delete nextCart[sku];
        removedOrClampedNames.push(product.name || sku);
        changed = true;
        continue;
      }
      if (curQty > avail) {
        nextCart[sku] = avail;
        removedOrClampedNames.push(product.name || sku);
        changed = true;
      }
      const prevPrice = nextPriceMap[sku];
      const latestPrice = safeNum(product.price, 0);
      if (prevPrice !== undefined && prevPrice !== latestPrice) {
        priceChangedNames.push(`${product.name} (₹${prevPrice} → ₹${latestPrice})`);
      }
      nextPriceMap[sku] = latestPrice;
    }

    cartPriceSnapshotRef.current = nextPriceMap;
    safeStorage.setJson("auditx_ordering_cart_prices", nextPriceMap);

    if (changed) {
      pendingCheckoutIdemRef.current = "";
      setCart(nextCart);
    }

    if (removedOrClampedNames.length > 0 && priceChangedNames.length > 0) {
      setCartNotice(`Item unavailable (${removedOrClampedNames[0]}) • Price updated (${priceChangedNames[0]})`);
      triggerToast("Cart updated: item availability & prices changed.");
    } else if (removedOrClampedNames.length > 0) {
      setCartNotice(`Item unavailable: updated stock for ${removedOrClampedNames[0]}`);
      triggerToast(`Notice: ${removedOrClampedNames[0]} availability changed.`);
    } else if (priceChangedNames.length > 0) {
      setCartNotice(`Price updated: ${priceChangedNames[0]}`);
      triggerToast(`Price updated for ${priceChangedNames[0]}`);
    }
  }, [effectiveCatalog, oosList, inventoryStockMap, getAvailableUnits]);

  const updateQty = useCallback((sku, delta) => {
    const cleanDelta = Math.trunc(safeNum(delta, 0));
    if (!cleanDelta) return;

    if (!isStoreOpen && cleanDelta > 0) {
      triggerToast("🛑 Store is closed right now, ordering soon!");
      return;
    }
    const item = effectiveCatalog.find((c) => c.sku === sku);
    if (!item && cleanDelta > 0) return;

    const itemName = String(item?.name || "").toLowerCase();
    if ((item?.soldOut || item?.inStock === false || itemName.includes("pup")) && cleanDelta > 0) {
      triggerToast(`⛔ "${item?.name || sku}" is currently unavailable!`);
      return;
    }
    if (item?.comingSoon && cleanDelta > 0) {
      triggerToast(`${item.name} is coming soon to Tiptur Dark Store!`);
      return;
    }
    const avail = item ? getAvailableUnits(item) : 0;
    if ((oosList.includes(sku) || avail <= 0) && cleanDelta > 0) {
      triggerToast(`⛔ "${item?.name || sku}" is currently unavailable!`);
      return;
    }

    const currentQty = Math.max(0, Math.floor(safeNum(cartRef.current?.[sku], 0)));
    if (cleanDelta > 0 && currentQty + cleanDelta > avail) {
      triggerToast(`⚠️ Only ${avail} unit(s) left in stock for "${item?.name || sku}"!`);
      return;
    }

    // Any cart modification creates a fresh checkout idempotency key on the next attempt
    pendingCheckoutIdemRef.current = "";
    setUnconfirmedOrderPrompt(null);
    setCartNotice("");

    setCart((prev) => {
      const next = { ...prev };
      const cur = Math.max(0, Math.floor(safeNum(next[sku], 0)));
      const clamped = Math.max(0, Math.min(avail > 0 ? avail : cur, cur + cleanDelta));
      if (clamped <= 0) delete next[sku];
      else next[sku] = clamped;
      return next;
    });

    if (item) {
      cartPriceSnapshotRef.current = {
        ...cartPriceSnapshotRef.current,
        [sku]: safeNum(item.price, 0),
      };
      safeStorage.setJson("auditx_ordering_cart_prices", cartPriceSnapshotRef.current);
      if (cleanDelta > 0 && !navigator?.connection?.saveData) {
        playSuccessChime();
      }
    }
  }, [isStoreOpen, effectiveCatalog, oosList, getAvailableUnits]);

  function handleReorderAll(pastOrder) {
    if (!isStoreOpen) {
      triggerToast("🛑 Store is closed right now, ordering soon!");
      return;
    }
    const next = {};
    let skipped = 0;
    (pastOrder?.items || []).forEach((it) => {
      const item = effectiveCatalog.find((c) => c.sku === it.sku);
      const avail = getAvailableUnits(item);
      if (!item || item.soldOut || item.inStock === false || item.comingSoon || oosList.includes(it.sku) || avail <= 0) {
        skipped += 1;
        return;
      }
      next[it.sku] = Math.min(avail, (next[it.sku] || 0) + (it.qty || 1));
    });
    if (Object.keys(next).length === 0) {
      triggerToast("These items are currently unavailable.");
      return;
    }
    setCart(next);
    playSuccessChime();
    setIsCheckoutView(true);
    triggerToast(skipped > 0 ? `Items added to cart (${skipped} unavailable skipped)` : "All items added to cart!");
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

  // Cart Calculations (memoized so child references never churn needlessly)
  const cartEntries = useMemo(() => Object.entries(cart || {}), [cart]);
  const totalItems = useMemo(
    () => cartEntries.reduce((s, [, q]) => s + Math.max(0, Math.floor(safeNum(q, 0))), 0),
    [cartEntries]
  );

  const cartItemsList = useMemo(() => {
    return cartEntries
      .map(([sku, qty]) => {
        const product = effectiveCatalog.find((c) => c.sku === sku);
        const cleanQty = Math.max(0, Math.floor(safeNum(qty, 0)));
        if (!product || cleanQty <= 0) return null;
        return { ...product, qty: cleanQty };
      })
      .filter(Boolean);
  }, [cartEntries, effectiveCatalog]);

  // Auto-close payment sheet and reset checkout view if cart becomes empty
  useEffect(() => {
    if (cartItemsList.length === 0) {
      if (showPaymentModal) setShowPaymentModal(false);
      if (isCheckoutView) setIsCheckoutView(false);
    }
  }, [cartItemsList.length, showPaymentModal, isCheckoutView]);

  const itemTotalMrp = useMemo(() => {
    return cartItemsList.reduce((s, item) => s + safeNum(item.mrp, safeNum(item.price, 0)) * item.qty, 0);
  }, [cartItemsList]);

  const itemSubtotal = useMemo(() => {
    return cartItemsList.reduce((s, item) => s + safeNum(item.price, 0) * item.qty, 0);
  }, [cartItemsList]);

  const productDiscount = Math.max(0, itemTotalMrp - itemSubtotal);

  const hasFramesInCart = useMemo(() => {
    return cartItemsList.some(
      (item) =>
        item.category === "Frames" ||
        item.sku?.startsWith("FRAME-") ||
        item.name?.toLowerCase().includes("frame")
    );
  }, [cartItemsList]);

  const isFreeDeliveryQualified = itemSubtotal >= FREE_DELIVERY_THRESHOLD || appliedCoupon?.freeDelivery;
  const deliveryFee = 0; // Free delivery for ₹1+ (no delivery charges)
  const handlingFee = appliedCoupon?.freeHandling ? 0 : (hasFramesInCart ? 10 : 0);

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
  const totalSavings = productDiscount + couponSavings + 25;

  // ── ONGOING ORDER TRACKING LOCK (only this customer's own undelivered order) ──
  const ongoingTrackedOrder = useMemo(() => {
    if (activeDeliveryOrder) {
      const st = (activeDeliveryOrder.status || "").toLowerCase();
      if (
        st !== "delivered" &&
        st !== "cancelled" &&
        st !== "arrived" &&
        st !== "rider_arrived" &&
        !activeDeliveryOrder.trackingDismissed &&
        orderingStage !== "rider_arrived" &&
        orderingStage !== "delivered"
      ) {
        return activeDeliveryOrder;
      }
    }
    return null;
  }, [activeDeliveryOrder, orderingStage]);

  const hasOngoingOrder = !!ongoingTrackedOrder;

  // Upsell Recommendations ("Before you checkout")
  const upsellRecommendations = useMemo(() => {
    return effectiveCatalog
      .filter((c) => !cart[c.sku] && !oosList.includes(c.sku) && !c.comingSoon && getAvailableUnits(c) > 0)
      .slice(0, 6);
  }, [cart, oosList, effectiveCatalog, inventoryStockMap]);

  // Categories & Filtering: Only Chocolates and Frames in active warehouse inventory
  const CATEGORY_DISPLAY = {
    "Chocolates": "🍫 Chocolates",
    "Frames": "🖼️ Wall Frames",
  };

  const categories = useMemo(() => {
    return ["Chocolates", "Frames"];
  }, []);

  const filteredCatalog = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    return effectiveCatalog.filter((item) => {
      const nameStr = String(item?.name || "").toLowerCase();
      const catStr = String(item?.category || "").toLowerCase();
      const aisleStr = String(item?.aisle || "").toLowerCase();
      const matchesSearch =
        !q || nameStr.includes(q) || catStr.includes(q) || aisleStr.includes(q);
      const matchesCategory = activeBottomTab === "search" ? true : item?.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [effectiveCatalog, debouncedSearchQuery, activeBottomTab, selectedCategory]);

  const visibleCatalog = useMemo(() => {
    return filteredCatalog.slice(0, visibleLimit);
  }, [filteredCatalog, visibleLimit]);

  // Incrementally load next chunk when >50 items via IntersectionObserver (zero scroll layout thrash)
  useEffect(() => {
    const sentinel = gridLoadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    if (visibleLimit >= filteredCatalog.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleLimit((v) => Math.min(filteredCatalog.length, v + 30));
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [visibleLimit, filteredCatalog.length]);

  useEffect(() => {
    if (!activeReservation?.expiresAtMs) {
      setReservationSecsLeft(0);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((activeReservation.expiresAtMs - Date.now()) / 1000));
      setReservationSecsLeft(rem);
      if (rem === 0) {
        const resCopy = activeReservation;
        setActiveReservation(null);
        releaseCheckoutReservation({
          reservationId: resCopy.reservationId,
          idempotencyKey: resCopy.idempotencyKey,
          reason: "expired",
        }).catch(() => { });
        triggerToast("5-minute stock hold expired. Tap Pay to reserve items again.");
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeReservation]);

  async function handleOpenPaymentModalWithReserve() {
    if (hasOngoingOrder) {
      const ongoingId = ongoingTrackedOrder?.orderNumber || ongoingTrackedOrder?.id || ongoingTrackedOrder?.orderId || "Current Order";
      triggerToast(`⚠️ Active Order in Progress! Order #${ongoingId} is currently being tracked.`);
      return;
    }
    if (!isStoreOpen) {
      triggerToast("🛑 Store is closed right now, ordering soon!");
      return;
    }
    if (cartItemsList.length === 0 || grandTotal <= 0) {
      triggerToast("Your cart is empty. Add items from the catalog.");
      setShowPaymentModal(false);
      setIsCheckoutView(false);
      return;
    }

    const idemKey = pendingCheckoutIdemRef.current || createIdempotencyKey("ord");
    pendingCheckoutIdemRef.current = idemKey;

    if (isOnlineNow() && (!activeReservation || activeReservation.idempotencyKey !== idemKey)) {
      const res = await reserveCheckoutStock({
        idempotencyKey: idemKey,
        items: cartItemsList.map((it) => ({ sku: it.sku, qty: it.qty })),
        userId: customer?.customerId || "customer",
        storeId: "TIPTUR-HUB-KA44",
        ttlMs: 300000,
      });
      if (!res.ok && res.outOfStock) {
        triggerToast(`⛔ ${res.error || "Selected item just ran out of stock."}`);
        fetchCloudHubState({ force: true }).catch(() => { });
        return;
      }
      if (res.ok && res.reservation) {
        setActiveReservation({
          reservationId: res.reservation.reservationId,
          idempotencyKey: idemKey,
          expiresAtMs: res.reservation.expiresAtMs || Date.now() + 300000,
        });
      }
    }

    setShowPaymentModal(true);
  }

  function handleCancelPaymentModal() {
    setShowPaymentModal(false);
    if (activeReservation && !placingOrder) {
      const resCopy = activeReservation;
      setActiveReservation(null);
      releaseCheckoutReservation({
        reservationId: resCopy.reservationId,
        idempotencyKey: resCopy.idempotencyKey,
        reason: "release",
      }).catch(() => { });
    }
  }

  function completeConfirmedOrder(confirmedOrder, itemCountSnap, grandTotalSnap) {
    const confirmedId = confirmedOrder.id || confirmedOrder.orderId || confirmedOrder.orderNumber;
    pendingCheckoutIdemRef.current = "";
    setActiveReservation(null);
    setCheckoutStatusMsg("");
    setUnconfirmedOrderPrompt(null);
    setCartNotice("");

    saveLiveOrder(confirmedOrder, { skipCloud: true });
    safeStorage.setJson("auditx_customer_last_order", confirmedOrder);
    const currEmail = String(confirmedOrder.customerEmail || customer?.email || "").toLowerCase().trim();
    const prevPast = safeArr(safeStorage.getJson("auditx_customer_past_orders", []));
    const pastEntry = {
      id: confirmedId,
      orderId: confirmedId,
      orderNumber: confirmedOrder.orderNumber || confirmedId,
      status: confirmedOrder.status || "pending",
      placedAt: confirmedOrder.createdAt || new Date().toISOString(),
      total: safeNum(confirmedOrder.totalAmount, grandTotalSnap),
      totalAmount: safeNum(confirmedOrder.totalAmount, grandTotalSnap),
      customerName: confirmedOrder.customerName,
      customerEmail: currEmail,
      customerPhone: confirmedOrder.customerPhone,
      customerAddress: confirmedOrder.customerAddress,
      paymentMethod: confirmedOrder.paymentMethod,
      deliveryFee: confirmedOrder.deliveryFee ?? 0,
      handlingFee: confirmedOrder.handlingFee ?? 0,
      pickerName: confirmedOrder.pickerName,
      captainName: confirmedOrder.captainName,
      items: safeArr(confirmedOrder.items).map((item) => ({
        sku: item.skuId || item.sku,
        name: item.name,
        qty: safeNum(item.qty, 1),
        price: safeNum(item.price, 0),
        image: item.image,
        category: item.category,
        unitSpecification: item.category === "Frames" ? "1 unit single" : "5 units fixed",
      })),
    };
    if (currEmail) {
      const prevCustPast = safeArr(safeStorage.getJson(`auditx_past_orders_${currEmail}`, []));
      const nextCustPast = [
        pastEntry,
        ...prevCustPast.filter((p) => (p?.id || p?.orderId) !== confirmedId),
      ].slice(0, 20);
      safeStorage.setJson(`auditx_past_orders_${currEmail}`, nextCustPast);
    }
    const nextPast = [
      pastEntry,
      ...prevPast.filter((p) => (p?.id || p?.orderId) !== confirmedId),
    ].slice(0, 20);
    safeStorage.setJson("auditx_customer_past_orders", nextPast);
    setPastOrders(currEmail ? [pastEntry, ...prevPast.filter((p) => {
      const pEmail = String(p?.customerEmail || p?.email || "").toLowerCase().trim();
      return (p?.id || p?.orderId) !== confirmedId && (!pEmail || pEmail === currEmail);
    })].slice(0, 20) : nextPast);

    safeStorage.remove("auditx_dismissed_track_order");
    safeStorage.remove("auditx_dismissed_slip_banner");
    safeStorage.remove("auditx_ordering_cart_prices");
    safeStorage.remove("auditx_ordering_checkout_step");
    cartPriceSnapshotRef.current = {};

    setLatestDeliveredSlipOrder(null);
    setDismissDeliveryBar(false);
    playNotificationChime();

    if (selectedPaymentMethod === "wallet" && customer) {
      const currentBal = safeNum(customer.walletBalance, WALLET_LIMIT);
      const updated = {
        ...customer,
        walletBalance: Math.max(0, currentBal - safeNum(confirmedOrder.totalAmount, grandTotalSnap)),
      };
      safeStorage.setJson("auditx_customer", updated);
      safeStorage.setJson("blinkit_customer", updated);
      setCustomer(updated);
    }

    setActiveDeliveryOrder(confirmedOrder);
    setOrderingStage("picking");
    setPickerDelayMins(0);
    setDeliveryCountdownSec(600);
    setCustomFloatingTitle("Order placed");
    setCustomFloatingSub("Packing your order");
    setCustomFloatingBadge("");
    setCart({});

    // Deduct stock units immediately on ordering device & broadcast in fraction of second
    if (Array.isArray(confirmedOrder.items)) {
      setInventoryStockMap((prev) => {
        const nextMap = { ...prev };
        const newlyOos = [];
        for (const item of confirmedOrder.items) {
          const sku = item.sku || item.skuId;
          if (sku) {
            const cur = Number(nextMap[sku] ?? getDefaultItemStock(item));
            const rem = Math.max(0, cur - Number(item.qty || 1));
            nextMap[sku] = rem;
            if (rem <= 0) newlyOos.push(sku);
          }
        }
        if (newlyOos.length > 0) {
          setOosList((prevOos) => Array.from(new Set([...prevOos, ...newlyOos])));
        }
        return nextMap;
      });
    }
    broadcastEvent("ORDER_CREATED", confirmedOrder);

    triggerToast(`Order #${confirmedId} Placed! Arriving in 10 minutes!`);

    if (!playedOrderPlacedIds.current.has(confirmedId)) {
      playedOrderPlacedIds.current.add(confirmedId);
      setPlacedOrderAnimation({
        orderId: confirmedId,
        etaMinutes:
          confirmedOrder?.etaMinutes ||
          confirmedOrder?.estimatedDeliveryMins ||
          confirmedOrder?.remainingMins ||
          10,
        itemCount: itemCountSnap,
        total: safeNum(confirmedOrder.totalAmount, grandTotalSnap),
      });
    } else {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        router.push(`/track/${confirmedId}`);
      }, 400);
    }
  }

  // Final Order Placement (idempotent, never double-charges, verifies on timeout/drop)
  async function handleFinalOrderPlacement() {
    await withIdempotentLock("place_order_submit", async () => {
      if (hasOngoingOrder) {
        const ongoingId = ongoingTrackedOrder?.orderNumber || ongoingTrackedOrder?.id || ongoingTrackedOrder?.orderId || "Current Order";
        triggerToast(`⚠️ Active Order in Progress! Order #${ongoingId} is currently being tracked.`);
        setShowPaymentModal(false);
        return;
      }
      if (!isOnlineNow()) {
        triggerToast("You're offline — reconnect before placing your order. Your cart is saved.");
        return;
      }
      if (!isStoreOpen) {
        triggerToast("🛑 Store is closed right now, ordering soon!");
        return;
      }
      if (!selectedAddress?.address) {
        triggerToast("📍 Please select or enter a delivery address first.");
        setShowAddressModal(true);
        return;
      }
      if (cartItemsList.length === 0) {
        triggerToast("Your cart is empty. Add items from the catalog.");
        setShowPaymentModal(false);
        setIsCheckoutView(false);
        return;
      }

      // Check latest price or stock shift immediately prior to charging
      let priceShifted = false;
      for (const item of cartItemsList) {
        const avail = getAvailableUnits(item);
        if (oosList.includes(item.sku) || avail < item.qty) {
          triggerToast(`⛔ "${item.name}" only has ${Math.max(0, avail)} unit(s) available now.`);
          return;
        }
        const snapPrice = cartPriceSnapshotRef.current?.[item.sku];
        if (snapPrice !== undefined && snapPrice !== safeNum(item.price, 0)) {
          priceShifted = true;
          cartPriceSnapshotRef.current[item.sku] = safeNum(item.price, 0);
        }
      }
      if (priceShifted) {
        safeStorage.setJson("auditx_ordering_cart_prices", cartPriceSnapshotRef.current);
        setCartNotice("Price updated — please review your updated total before paying.");
        triggerToast("Price updated in cart — review total and tap Pay again.");
        setShowPaymentModal(false);
        return;
      }

      setPlacingOrder(true);
      setCheckoutStatusMsg("Placing your order...");
      setShowPaymentModal(false);
      setUnconfirmedOrderPrompt(null);

      try {
        const idempotencyKey = pendingCheckoutIdemRef.current || createIdempotencyKey("ord");
        pendingCheckoutIdemRef.current = idempotencyKey;

        const orderId = `ORD-KA44-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const rack = getRandomStagingRack();

        const createdOrder = {
          id: orderId,
          orderId,
          orderNumber: orderId,
          idempotencyKey,
          reservationId: activeReservation?.reservationId || "",
          customerId: customer?.customerId || `cust_${customer?.email || Date.now()}`,
          customerName: customer?.name || "Customer",
          customerEmail: customer?.email || "",
          customerPhone: customer?.phone || "",
          customerAddress: selectedAddress?.address || "KFGSC , Tiptur 572201",
          addressDetails: selectedAddress,
          deliveryInstructions: selectedInstructions.map(
            (id) => DELIVERY_INSTRUCTIONS_LIST.find((i) => i.id === id)?.label
          ).filter(Boolean),
          appliedCoupon: appliedCoupon?.code || null,
          couponSavings,
          totalAmount: grandTotal,
          itemTotal: itemSubtotal,
          deliveryFee,
          handlingFee,
          totalSavings,
          status: "placed",
          stage: "Awaiting OD Picker",
          lastEmailedStatus: "placed",
          assignedRack: rack.id,
          assignedRackZone: rack.zone,
          rackQr: rack.qr,
          assignedStaffId: "thrupthi",
          deliveryCaptainId: "sinchana",
          paymentMethod:
            selectedPaymentMethod === "wallet"
              ? "Audit'X Demo Wallet"
              : selectedPaymentMethod === "upi"
                ? `UPI Direct (${selectedUpiApp.toUpperCase()})`
                : selectedPaymentMethod === "card"
                  ? "Saved Credit Card"
                  : "Cash on Delivery",
          storeId: "TIPTUR-HUB-KA44",
          storeName: "AUDIT'X Tiptur HUB - KA44",
          estimatedDeliveryMins: 10,
          createdAt: new Date().toISOString(),
          qrCode: `AUDITX-ORD-${orderId}-CUSTOMER-QR`,
          items: cartItemsList.map((item) => ({
            skuId: item.sku,
            name: item.name,
            category: item.category,
            units: item.category === "Frames" ? 1 : 5,
            unitSpecification: item.category === "Frames" ? "1 unit single" : "5 units fixed",
            qty: item.qty,
            binLocation: item.aisle || "Aisle C1 - S1 - 001",
            price: safeNum(item.price, 0),
            mrp: safeNum(item.mrp, item.price),
            image: item.image,
            isCustomPutaway: !!item.isCustomPutaway,
          })),
        };

        const currentItemCount = totalItems;
        const currentTotal = grandTotal;

        // Validate & persist atomically without blind retry (retries: 0 inside dispatchCloudAction)
        let cloudRes = await dispatchCloudAction("PLACE_ORDER", {
          order: createdOrder,
          idempotencyKey,
          reservationId: activeReservation?.reservationId || "",
        });

        // If 401 token expired -> silently refresh session cookie and retry placement once cleanly
        if (cloudRes && !cloudRes.ok && cloudRes.status === 401) {
          const refreshed = await attemptSilentSessionRefresh();
          if (refreshed) {
            cloudRes = await dispatchCloudAction("PLACE_ORDER", {
              order: createdOrder,
              idempotencyKey,
              reservationId: activeReservation?.reservationId || "",
            });
          } else {
            safeStorage.set("auditx_auth_return_to", "/ordering/checkout", "session");
            triggerToast("Session expired — sign in to finish checkout (your cart is saved).");
            router.replace("/ordering/login?returnTo=/ordering/checkout");
            return;
          }
        }

        if (cloudRes?.state?.inventoryStockMap) setInventoryStockMap(cloudRes.state.inventoryStockMap);
        if (cloudRes?.state?.oosList) setOosList(cloudRes.state.oosList);

        if (cloudRes && !cloudRes.ok) {
          // Timeout, busy server (5xx/429), or dropped network right after submit -> poll order status by idempotencyKey!
          if (cloudRes.timedOut || cloudRes.status === 0 || cloudRes.status === 429 || cloudRes.status >= 500) {
            setCheckoutStatusMsg("Hang tight, still placing your order...");
            for (let pollAttempt = 0; pollAttempt < 2; pollAttempt++) {
              const matchedOrder = await verifyPlacedOrderStatus({ idempotencyKey, orderId });
              if (matchedOrder) {
                completeConfirmedOrder(matchedOrder, currentItemCount, currentTotal);
                return;
              }
              await new Promise((r) => setTimeout(r, 650));
            }
            setUnconfirmedOrderPrompt({
              idempotencyKey,
              message: "We couldn't confirm your order due to a connection drop. Check My Orders or tap Retry — you will not be charged twice.",
            });
            triggerToast("We couldn't confirm your order. Check My Orders or tap Retry.");
            return;
          }

          // Release held stock reservation cleanly on payment/validation decline
          if (activeReservation) {
            const resCopy = activeReservation;
            setActiveReservation(null);
            releaseCheckoutReservation({
              reservationId: resCopy.reservationId,
              idempotencyKey: resCopy.idempotencyKey,
              reason: "payment_failed",
            }).catch(() => { });
          }

          if (cloudRes.data?.storeClosed) {
            setIsStoreOpen(false);
            triggerToast("🛑 Store just closed right now, ordering soon!");
          } else if (cloudRes.data?.outOfStock) {
            triggerToast(`⛔ ${cloudRes.error || "Selected item went out of stock during checkout."}`);
          } else {
            triggerToast(`⚠️ ${cloudRes.error || "Payment / checkout declined. Please retry."}`);
          }
          return;
        }

        const confirmedOrder = cloudRes?.data?.order || createdOrder;
        completeConfirmedOrder(confirmedOrder, currentItemCount, currentTotal);
      } finally {
        setPlacingOrder(false);
        setCheckoutStatusMsg("");
      }
    });
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

  const handleStoreClosedToast = useCallback(() => {
    triggerToast("🛑 Store is closed right now, ordering soon!");
  }, []);

  const handleOpenComingSoon = useCallback(() => {
    setShowComingSoonModal(true);
  }, []);

  if (!authChecked) {
    return <OrderingSkeletonScreen />;
  }

  if (capacityBlockedMsg) {
    return (
      <IOSMobileShell>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 24, textAlign: "center", minHeight: "100%" }}>
          <div className="ios-card" style={{ padding: 26, border: "1px solid rgba(255,59,48,0.4)", maxWidth: 360 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🚫</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900, color: "#FF3B30" }}>
              Daily Capacity Full (400 / 400 Devices)
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              {capacityBlockedMsg}
            </p>
          </div>
        </div>
      </IOSMobileShell>
    );
  }

  const etaHeadlineText =
    orderingStage === "rider_arrived"
      ? "Rider ARRIVED"
      : orderingStage === "almost_doorstep"
        ? "Almost at doorstep"
        : orderingStage === "one_minute"
          ? "Arriving in 1 MIN"
          : orderingStage === "delivered" && !rateCompleted
            ? "Delivered • Rate"
            : activeDeliveryOrder && orderingStage === "picking" && pickerDelayMins > 0
              ? `Delivery in ${10 + pickerDelayMins} MINS`
              : activeDeliveryOrder && deliveryCountdownSec > 0
                ? `Delivery in ${Math.max(1, Math.ceil(deliveryCountdownSec / 60))} MIN${Math.max(1, Math.ceil(deliveryCountdownSec / 60)) === 1 ? "" : "S"}`
                : "Delivery in 10 MINS";

  const activeTabLargeTitle = isCheckoutView
    ? "Checkout"
    : activeBottomTab === "categories"
      ? "Categories"
      : activeBottomTab === "search"
        ? "Search"
        : activeBottomTab === "order_again"
          ? "Orders"
          : activeBottomTab === "explore_tiptur"
            ? "Tiptur Hub"
            : "AUDIT'X";

  const orderingHeaderElement = (
    <IOSNavBar
      largeTitle={activeTabLargeTitle}
      subtitle="10-Min Hub KA44"
      onBack={
        isCheckoutView
          ? () => {
            if (showPaymentModal) {
              handleCancelPaymentModal();
              return;
            }
            setIsCheckoutView(false);
          }
          : activeBottomTab !== "home"
            ? () => setActiveBottomTab("home")
            : undefined
      }
      backLabel={isCheckoutView ? "Store" : "Home"}
      subHeader={
        <div>
          <AuditxSuiteTopBar
            variant="ordering"
            isStoreOpen={isStoreOpen}
            userName={customer?.name || "Customer"}
            userInitial={customer?.name ? customer.name.charAt(0) : "C"}
            onUserClick={() => {
              if (customer?.name) {
                setShowProfileModal(true);
              } else {
                const returnPath = typeof window !== "undefined" ? window.location.pathname || "/ordering" : "/ordering";
                safeStorage.set("auditx_auth_return_to", returnPath, "session");
                router.push(`/ordering/login?returnTo=${encodeURIComponent(returnPath)}`);
              }
            }}
            cartCount={totalItems}
            onCartClick={() => setIsCheckoutView(!isCheckoutView)}
            supportCount={customerComplaints.length}
            onSupportClick={() => {
              if (activeDeliveryOrder) {
                setComplaintOrderId(activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId);
              }
              setShowComplaintModal(true);
            }}
          />

          {/* Compact Delivery Address Chip */}
          {!isCheckoutView && (
            <button
              type="button"
              data-dfx="delivery"
              onClick={() => setShowAddressModal(true)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "7px 11px",
                borderRadius: 12,
                border: "0.5px solid var(--ios-sep)",
                background: "var(--ios-fill-secondary)",
                color: "var(--ios-label)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>⚡</span>
                <span className="ios-footnote" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {etaHeadlineText}
                </span>
                <span className="ios-caption" style={{ color: "var(--ios-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  • {selectedAddress?.address || "KFGSC , Tiptur 572201"}
                </span>
              </div>
              <IconChevronDown size={14} color="#007AFF" />
            </button>
          )}
        </div>
      }
    />
  );

  const orderingTabBarElement = (
    <IOSTabBar
      activeId={
        isCheckoutView
          ? "cart"
          : activeBottomTab === "order_again" || activeBottomTab === "explore_tiptur"
            ? "orders"
            : activeBottomTab
      }
      onChange={(nextTab) => {
        if (nextTab === "cart") {
          if (cartItemsList.length === 0) {
            triggerToast("Your cart is empty. Add items from the catalog.");
            setIsCheckoutView(false);
            return;
          }
          setIsCheckoutView(true);
          return;
        }
        if (nextTab === "orders") {
          setIsCheckoutView(false);
          setActiveBottomTab("order_again");
          return;
        }
        setIsCheckoutView(false);
        setActiveBottomTab(nextTab);
        if (nextTab === "search") {
          setTimeout(() => {
            try {
              searchInputRef.current?.focus();
            } catch { }
          }, 120);
        }
      }}
      tabs={[
        { id: "home", domId: "tab-home", label: "Home", icon: "home" },
        { id: "categories", domId: "tab-categories", label: "Categories", icon: "categories" },
        { id: "search", domId: "tab-search", label: "Search", icon: "search" },
        { id: "cart", domId: "tab-cart", label: "Cart", icon: "cart", badge: totalItems },
        { id: "orders", domId: "tab-order-again", label: "Orders", icon: "orders" },
      ]}
    />
  );

  return (
    <>
      <IOSToast message={toastMessage} />

      <IOSMobileShell
        shellId="ax-ordering-shell"
        dataDfx="page"
        header={orderingHeaderElement}
        tabBar={orderingTabBarElement}
        overlay={
          placedOrderAnimation ? (
            <OrderPlacedSheet
              orderId={placedOrderAnimation.orderId}
              etaMinutes={placedOrderAnimation.etaMinutes}
              itemCount={placedOrderAnimation.itemCount}
              total={placedOrderAnimation.total}
              onDone={() => {
                const destId = placedOrderAnimation.orderId;
                setPlacedOrderAnimation(null);
                router.push(`/track/${destId}`);
              }}
            />
          ) : null
        }
        onRefresh={() => {
          fetchCloudHubState({ force: true }).catch(() => { });
          dispatchCloudAction("HEARTBEAT", { deviceUid: getOrCreateDeviceUid() });
        }}
        onSwipeBack={
          isCheckoutView
            ? () => {
              if (showPaymentModal) {
                setShowPaymentModal(false);
                return;
              }
              if (placingOrder) {
                triggerToast("Completing order verification — please wait a moment.");
                return;
              }
              setIsCheckoutView(false);
            }
            : activeBottomTab !== "home"
              ? () => setActiveBottomTab("home")
              : undefined
        }
        stickyFooter={
          isCheckoutView ? (
            <div
              style={{
                background: "var(--ios-chrome-bg)",
                WebkitBackdropFilter: "saturate(180%) blur(20px)",
                backdropFilter: "saturate(180%) blur(20px)",
                borderTop: "0.5px solid var(--ios-sep)",
                padding: "10px 14px",
              }}
            >
              <div style={S.stickyBarInner}>
                <div style={S.stickyPriceCol}>
                  <div style={S.stickyTotalRow}>
                    <span style={{ ...S.stickyTotalAmount, color: "var(--ios-label)" }}>₹{grandTotal}</span>
                    <span style={S.stickyTotalWord}>Total</span>
                  </div>
                  <div style={S.stickySavingsNote}>
                    {!isOnline ? (
                      <span style={{ color: "#D97706", fontWeight: 700 }}>
                        Offline — reconnect to checkout
                      </span>
                    ) : hasOngoingOrder ? (
                      <span style={{ color: "#FF9500", fontWeight: 700 }}>
                        Active: #{ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id}
                      </span>
                    ) : (
                      <span>Audit&apos;X Demo Wallet</span>
                    )}
                  </div>
                </div>

                {hasOngoingOrder ? (
                  <IOSButton
                    fullWidth={false}
                    variant="primary"
                    minHeight={46}
                    style={{ background: "#FF9500" }}
                    onClick={() => {
                      const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                      router.push(`/track/${ordId}`);
                    }}
                  >
                    Track Live →
                  </IOSButton>
                ) : !isOnline ? (
                  <IOSButton
                    fullWidth={false}
                    variant="tinted"
                    minHeight={46}
                    disabled
                    onClick={() => triggerToast("You're offline — checkout unlocks automatically when connected.")}
                  >
                    Offline
                  </IOSButton>
                ) : !isStoreOpen ? (
                  <IOSButton
                    fullWidth={false}
                    variant="danger"
                    minHeight={46}
                    onClick={handleStoreClosedToast}
                  >
                    Store Closed
                  </IOSButton>
                ) : (
                  <IOSButton
                    fullWidth={false}
                    variant="green"
                    minHeight={48}
                    disabled={placingOrder || cartItemsList.length === 0}
                    loading={placingOrder}
                    onClick={handleOpenPaymentModalWithReserve}
                  >
                    {placingOrder ? (checkoutStatusMsg || "Placing your order...") : "Place Order →"}
                  </IOSButton>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {/* ── INTRO SPLASH VIDEO & ORDER PLACED OVERLAYS ── */}
        {showIntroOverlay && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 440,
              zIndex: 999999,
              background: "#0c100e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 0 40px rgba(0, 0, 0, 0.75)",
              opacity: introFadeOut ? 0 : 1,
              transition: "opacity 550ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: introFadeOut ? "none" : "auto",
            }}
          >
            <video
              ref={introVideoRef}
              src="/team-intro.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              controls={false}
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback"
              onPlay={(e) => {
                e.currentTarget.muted = true;
                e.currentTarget.defaultMuted = true;
                e.currentTarget.volume = 0;
                introLastTickAtRef.current = Date.now();
              }}
              onPlaying={() => {
                introHasStartedRef.current = true;
                introLastTickAtRef.current = Date.now();
              }}
              onTimeUpdate={() => {
                introHasStartedRef.current = true;
                introLastTickAtRef.current = Date.now();
              }}
              onEnded={() => finishIntroSplash(false)}
              onError={() => finishIntroSplash(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
                display: "block",
                background: "#0c100e",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
          MAIN VIEW: CHECKOUT OR CATALOG (WITH STORE CLOSED BANNER)
          ═══════════════════════════════════════════════════════════ */}
        {isCheckoutView ? (
          /* ── DEDICATED BLINKIT CART & CHECKOUT PAGE (EXACT ASCII WIREFRAME) ── */
          <ErrorBoundary
            label="Cart & Checkout"
            subtitle="Your cart items and address are safely preserved. Tap Try again to resume."
            onRetry={() => fetchCloudHubState({ force: true })}
          >
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

                {!isOnline && (
                  <div
                    role="status"
                    style={{
                      background: "#FFFBEB",
                      border: "1.5px solid #F59E0B",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#92400E",
                    }}
                  >
                    You&apos;re offline — your cart is saved safely. Checkout unlocks as soon as you&apos;re back online.
                  </div>
                )}

                {checkoutStatusMsg && (
                  <div
                    role="status"
                    style={{
                      background: "#ECFDF5",
                      border: "1.5px solid #34D399",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 12,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#065F46",
                    }}
                  >
                    ⏳ {checkoutStatusMsg}
                  </div>
                )}

                {reservationSecsLeft > 0 && (
                  <div
                    role="status"
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      borderRadius: 12,
                      padding: "8px 12px",
                      marginBottom: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#166534",
                    }}
                  >
                    🔒 Stock reserved for you ({Math.floor(reservationSecsLeft / 60)}:{String(reservationSecsLeft % 60).padStart(2, "0")})
                  </div>
                )}

                {cartNotice && (
                  <div
                    role="status"
                    style={{
                      background: "#EFF6FF",
                      border: "1.5px solid #93C5FD",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1E40AF",
                    }}
                  >
                    <span>ℹ️ {cartNotice}</span>
                    <button
                      type="button"
                      onClick={() => setCartNotice("")}
                      style={{ background: "none", border: "none", color: "#1E40AF", fontWeight: 800, cursor: "pointer" }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {unconfirmedOrderPrompt && (
                  <div
                    role="alert"
                    style={{
                      background: "#FEF2F2",
                      border: "1.5px solid #FCA5A5",
                      borderRadius: 14,
                      padding: "12px 14px",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", marginBottom: 4 }}>
                      Order confirmation interrupted
                    </div>
                    <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.45, marginBottom: 10 }}>
                      {unconfirmedOrderPrompt.message}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={placingOrder || !isOnline}
                        onClick={handleFinalOrderPlacement}
                        style={{
                          flex: 1,
                          minHeight: 38,
                          borderRadius: 10,
                          border: "none",
                          background: "#0C831F",
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Retry Order
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCheckoutView(false);
                          setActiveBottomTab("order_again");
                          fetchCloudHubState({ force: true }).catch(() => { });
                        }}
                        style={{
                          flex: 1,
                          minHeight: 38,
                          borderRadius: 10,
                          border: "1px solid #DC2626",
                          background: "#FFFFFF",
                          color: "#991B1B",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Check My Orders
                      </button>
                    </div>
                  </div>
                )}

                {/* ACTIVE ORDER ONGOING TRACKING LOCK BANNER */}
                {hasOngoingOrder && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                      border: "1.5px solid #f59e0b",
                      borderRadius: 14,
                      padding: "14px 16px",
                      marginBottom: 16,
                      boxShadow: "0 4px 14px rgba(245, 158, 11, 0.18)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontSize: 24, lineHeight: 1 }}>🛵</span>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#92400e" }}>
                            Ongoing Delivery Active • Order #{ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 3, lineHeight: 1.45 }}>
                            You cannot place another order while live tracking is in progress. Your cart items are safely preserved and checkout will automatically unlock once this order finishes and is delivered!
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                          router.push(`/track/${ordId}`);
                        }}
                        style={{
                          background: "#d97706",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Track Live 📍
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. TOP DELIVERY & ADDRESS BAR (IN CHECKOUT) */}
                <div style={S.checkoutCard}>
                  <div style={S.checkoutEtaHeader}>
                    <div style={S.checkoutEtaLeft}>
                      <div style={S.checkoutEtaPill}>
                        <IconLightning size={16} color="#000000" />
                        <span style={S.checkoutEtaTime}>Delivery in 10 MINS</span>
                      </div>
                      <div style={S.checkoutAddressSub}>
                        KFGSC , Tiptur 572201
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
                      <span style={S.unlockedFreeText}>
                        <IconCheck size={14} color="#0c831f" /> You have unlocked <b>FREE Delivery</b>!
                      </span>
                      <span style={S.deliveryFeeBadge}>
                        FREE
                      </span>
                    </div>
                    <div style={S.progressTrack}>
                      <div
                        style={{
                          ...S.progressFill,
                          width: "100%",
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
                        const avail = getAvailableUnits(item);
                        const isOos = oosList.includes(item.sku) || avail <= 0;
                        return (
                          <div key={item.sku} style={S.itemCardRow}>
                            {/* Product Image */}
                            <div style={S.itemImgWrapper}>
                              <img
                                src={item.image || "/auditx-logo.png"}
                                alt={item.name}
                                width={56}
                                height={56}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  if (e.currentTarget.dataset.fbApplied) return;
                                  e.currentTarget.dataset.fbApplied = "1";
                                  e.currentTarget.src = "/auditx-logo.png";
                                }}
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
                                disabled={isOos || item.qty >= avail}
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
                      <span style={S.billLabel}>Delivery</span>
                      <span style={S.billFreeHighlight}>FREE</span>
                    </div>

                    <div style={S.billRow}>
                      <span style={S.billLabel}>Handling fee</span>
                      <span style={handlingFee === 0 ? S.billFreeHighlight : S.billValue}>
                        {handlingFee === 0 ? "FREE" : `₹${handlingFee}`}
                      </span>
                    </div>

                    <div style={S.billDivider} />

                    <div style={S.billGrandTotalRow}>
                      <span style={S.grandTotalLabel}>Total</span>
                      <span style={S.grandTotalAmount}>₹{grandTotal}</span>
                    </div>
                  </div>
                </section>

                {/* 5. DELIVERY INSTRUCTIONS & PREFERENCES */}
                <section style={S.checkoutCard}>
                  <div style={S.sectionHeaderRow}>
                    <h3 style={S.cardSectionTitle}>DELIVERY INSTRUCTIONS</h3>
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
                </section>

                {/* 5B. PAYMENT METHOD SUMMARY STRIP */}
                <section style={S.checkoutCard}>
                  <div style={S.sectionHeaderRow}>
                    <h3 style={S.cardSectionTitle}>PAYMENT METHOD</h3>
                    {!hasOngoingOrder && cartItemsList.length > 0 && (
                      <button
                        type="button"
                        style={S.changeLinkBtn}
                        onClick={handleOpenPaymentModalWithReserve}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  <div
                    style={S.selectedPaymentMethodRow}
                    onClick={() => {
                      if (hasOngoingOrder) {
                        const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                        router.push(`/track/${ordId}`);
                      } else if (cartItemsList.length > 0) {
                        handleOpenPaymentModalWithReserve();
                      } else {
                        triggerToast("Your cart is empty. Add items from the catalog.");
                        setIsCheckoutView(false);
                      }
                    }}
                  >
                    <div style={S.paymentMethodLeftPreview}>
                      <IconRealLogoAuditxWallet size={36} />
                      <div>
                        <div style={S.paymentMethodSelectedTitle}>
                          Audit'X Demo Wallet
                          <span style={S.oneClickPill}>1-CLICK INSTANT</span>
                        </div>
                        <div style={S.paymentMethodSelectedSub}>
                          Paid through demo wallet • Balance: ₹{safeNum(customer?.walletBalance, WALLET_LIMIT).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    <div style={S.paymentMethodCheckActive}>
                      <IconCheck size={14} color="#0c831f" />
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (hasOngoingOrder) return;
                      if (cartItemsList.length > 0) {
                        handleOpenPaymentModalWithReserve();
                      } else {
                        triggerToast("Your cart is empty. Add items from the catalog.");
                        setIsCheckoutView(false);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      cursor: hasOngoingOrder ? "default" : "pointer",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                      UPI Apps
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <IconRealLogoPhonePe size={28} />
                      <IconRealLogoGooglePay size={28} />
                      <IconRealLogoPaytm size={28} />
                      <IconRealLogoUPI size={28} />
                    </div>
                  </div>
                </section>

                {/* Spacer for sticky footer */}
                <div style={{ height: 20 }} />
              </div>
            </main>
          </ErrorBoundary>
        ) : (
          /* ── CATALOG BROWSE VIEW (STORE WITH SMART CART BAR) ── */
          <main style={S.catalogMain}>
            <div style={S.catalogContainer}>
              {/* Store Closed Notice Banner */}
              {!isStoreOpen && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #fff1f3 0%, #ffe4e6 100%)",
                    border: "1.5px solid #fecdd3",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 12,
                    boxShadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🏪</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "#e11d48",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          letterSpacing: 0.5,
                        }}
                      >
                        STORE CLOSED
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#9f1239" }}>
                        Store is closed right now • Ordering opening soon!
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Delivered Order PDF Slip Banner on Home (non-blocking, dismissible) */}
              {!hasOngoingOrder && latestDeliveredSlipOrder && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                    border: "1.5px solid #86efac",
                    borderRadius: 14,
                    padding: "11px 12px",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    boxShadow: "0 2px 10px rgba(12, 131, 31, 0.1)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#14532D" }}>
                      ✅ Order #{latestDeliveredSlipOrder.orderNumber || latestDeliveredSlipOrder.id} Delivered
                    </div>
                    <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>
                      {(latestDeliveredSlipOrder.items || []).length} delivered item(s) • ₹{latestDeliveredSlipOrder.totalAmount ?? latestDeliveredSlipOrder.total ?? 0}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => downloadDeliverySlipPdf(latestDeliveredSlipOrder)}
                      style={{
                        background: "#0c831f",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 11px",
                        fontSize: 11.5,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: "0 2px 6px rgba(12, 131, 31, 0.25)",
                      }}
                      title="Download delivery slip (PDF)"
                    >
                      📥 Download Slip
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss delivered slip banner"
                      onClick={() => {
                        const ordId = String(
                          latestDeliveredSlipOrder.id ||
                          latestDeliveredSlipOrder.orderId ||
                          latestDeliveredSlipOrder.orderNumber ||
                          ""
                        );
                        if (ordId) safeStorage.set("auditx_dismissed_slip_banner", ordId);
                        setLatestDeliveredSlipOrder(null);
                      }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "1px solid #86efac",
                        background: "#ffffff",
                        color: "#166534",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Top Ongoing Order Alert in Catalog */}
              {hasOngoingOrder && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                    border: "1.5px solid #f59e0b",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>🛵</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#92400e" }}>
                        Order #{ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id} is Live &amp; Tracked
                      </div>
                      <div style={{ fontSize: 11, color: "#b45309" }}>
                        Express delivery underway • New order checkout unlocks automatically once delivered!
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                      router.push(`/track/${ordId}`);
                    }}
                    style={{
                      background: "#d97706",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 7,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Track Live →
                  </button>
                </div>
              )}

              {activeBottomTab === "home" && (
                <>
                  {/* Isolated Search Bar */}
                  <OrderingSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClear={() => setSearchQuery("")}
                    S={S}
                  />

                  {/* Quick Category Tabs: only Chocolates and Frames */}
                  <div style={S.categoryTabsRow}>
                    {categories.map((cat) => {
                      const active = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          data-dfx="chip"
                          aria-pressed={active}
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
                              🍫 Dark Store Warehouse Special: {effectiveCatalog.filter((c) => c.category === "Chocolates").length} chocolate varieties tracked live!
                            </p>
                          )}
                          {selectedCategory === "Frames" && (
                            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#6366f1", fontWeight: 700 }}>
                              🖼️ Dark Store Warehouse Special: {effectiveCatalog.filter((c) => c.category === "Frames").length} Art &amp; Heritage Glass Frames!
                            </p>
                          )}
                        </div>
                        <span style={S.catalogItemCount}>
                          {filteredCatalog.length} items
                        </span>
                      </div>

                      {/* Product Cards Grid (Memoized + Virtualized Window + Lazy Images + ErrorBoundary) */}
                      <ErrorBoundary
                        label="Product Catalog"
                        compact
                        onRetry={() => fetchCloudHubState({ force: true })}
                      >
                        <CatalogBoundaryProbe />
                        {loading && visibleCatalog.length === 0 ? (
                          <OrderingSkeletonScreen />
                        ) : visibleCatalog.length === 0 ? (
                          <div
                            className="ios-card"
                            style={{
                              padding: "32px 18px",
                              textAlign: "center",
                              margin: "10px 0 18px",
                            }}
                          >
                            <div style={{ fontSize: 34, marginBottom: 8 }}>🔍</div>
                            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "var(--ios-label)" }}>
                              No matching items found
                            </h3>
                            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ios-label-2)" }}>
                              Try another keyword or clear your search filter to see all store items.
                            </p>
                            <IOSButton
                              variant="green"
                              fullWidth={false}
                              minHeight={42}
                              onClick={() => setSearchQuery("")}
                            >
                              Clear search
                            </IOSButton>
                          </div>
                        ) : (
                          <div style={S.productGrid}>
                            {visibleCatalog.map((item, idx) => {
                              const qty = cart[item.sku] || 0;
                              const availableUnits = getAvailableUnits(item);
                              const isSoldOut = item.soldOut === true || item.inStock === false || isPuppyFrame(item) || availableUnits <= 0;
                              const isAutoOos = availableUnits <= 0;
                              const isOos = oosList.includes(item.sku) || isSoldOut || isAutoOos;
                              return (
                                <OrderingProductCard
                                  key={item.sku}
                                  item={item}
                                  idx={idx}
                                  qty={qty}
                                  availableUnits={availableUnits}
                                  isOos={isOos}
                                  isSoldOut={isSoldOut}
                                  isChoc={item.category === "Chocolates"}
                                  isFrame={item.category === "Frames"}
                                  isStoreOpen={isStoreOpen}
                                  onUpdateQty={updateQty}
                                  onOpenComingSoon={handleOpenComingSoon}
                                  onStoreClosedToast={handleStoreClosedToast}
                                  S={S}
                                />
                              );
                            })}
                          </div>
                        )}
                      </ErrorBoundary>
                      {visibleCatalog.length < filteredCatalog.length && (
                        <div ref={gridLoadMoreRef} style={{ padding: "16px 0", textAlign: "center" }}>
                          <IOSButton
                            variant="tinted"
                            fullWidth={false}
                            minHeight={40}
                            onClick={() => setVisibleLimit((v) => Math.min(filteredCatalog.length, v + 30))}
                          >
                            Show more ({filteredCatalog.length - visibleCatalog.length} remaining)
                          </IOSButton>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════════
            TAB: DEDICATED SEARCH (iOS SEARCH BAR + ALL CATALOG)
            ══════════════════════════════════════════ */}
              {activeBottomTab === "search" && (
                <div className="ios-tab-crossfade" style={S.tabViewContainer}>
                  <OrderingSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClear={() => setSearchQuery("")}
                    inputRef={searchInputRef}
                    sticky
                    S={S}
                  />

                  <ErrorBoundary
                    label="Search Results"
                    compact
                    onRetry={() => fetchCloudHubState({ force: true })}
                  >
                    {visibleCatalog.length === 0 ? (
                      <div
                        className="ios-card"
                        style={{
                          padding: "36px 20px",
                          textAlign: "center",
                          marginTop: 12,
                        }}
                      >
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🔎</div>
                        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "var(--ios-label)" }}>
                          No results for &ldquo;{searchQuery.trim()}&rdquo;
                        </h3>
                        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ios-label-2)" }}>
                          Search chocolates like Beatss, Melody, Kopiko or A4 wall frames.
                        </p>
                        <IOSButton
                          variant="green"
                          fullWidth={false}
                          minHeight={42}
                          onClick={() => setSearchQuery("")}
                        >
                          Show all items
                        </IOSButton>
                      </div>
                    ) : (
                      <div style={S.productGrid}>
                        {visibleCatalog.map((item, idx) => {
                          const qty = cart[item.sku] || 0;
                          const availableUnits = getAvailableUnits(item);
                          const isSoldOut = item.soldOut === true || item.inStock === false || isPuppyFrame(item) || availableUnits <= 0;
                          const isAutoOos = availableUnits <= 0;
                          const isOos = oosList.includes(item.sku) || isSoldOut || isAutoOos;
                          return (
                            <OrderingProductCard
                              key={item.sku}
                              item={item}
                              idx={idx}
                              qty={qty}
                              availableUnits={availableUnits}
                              isOos={isOos}
                              isSoldOut={isSoldOut}
                              isChoc={item.category === "Chocolates"}
                              isFrame={item.category === "Frames"}
                              isStoreOpen={isStoreOpen}
                              onUpdateQty={updateQty}
                              onOpenComingSoon={handleOpenComingSoon}
                              onStoreClosedToast={handleStoreClosedToast}
                              S={S}
                            />
                          );
                        })}
                      </div>
                    )}
                    {visibleCatalog.length < filteredCatalog.length && (
                      <div style={{ padding: "16px 0", textAlign: "center" }}>
                        <IOSButton
                          variant="tinted"
                          fullWidth={false}
                          minHeight={40}
                          onClick={() => setVisibleLimit((v) => Math.min(filteredCatalog.length, v + 30))}
                        >
                          Show more ({filteredCatalog.length - visibleCatalog.length} remaining)
                        </IOSButton>
                      </div>
                    )}
                  </ErrorBoundary>
                </div>
              )}

              {/* ══════════════════════════════════════════
            TAB 2: ORDERS & PROFILE (PAST ORDERS + ACCOUNT + EXPLORE)
            ══════════════════════════════════════════ */}
              {activeBottomTab === "order_again" && (
                <div className="ios-tab-crossfade" style={S.tabViewContainer}>
                  <IOSGroupedList header="Account & Hub">
                    <IOSListRow
                      leading={
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#007AFF", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
                          {customer?.name ? customer.name.charAt(0).toUpperCase() : "A"}
                        </div>
                      }
                      title={customer?.name || "Customer Account"}
                      subtitle={`Demo Wallet: ₹${safeNum(customer?.walletBalance, WALLET_LIMIT).toLocaleString("en-IN")}`}
                      chevron
                      onClick={() => setShowProfileModal(true)}
                    />
                    <IOSListRow
                      leading={<span style={{ fontSize: 18 }}>🌴</span>}
                      title="Explore Namma Tiptur"
                      subtitle="Heritage temples, cafes & local highlights"
                      chevron
                      last
                      onClick={() => setActiveBottomTab("explore_tiptur")}
                    />
                  </IOSGroupedList>
                  <div style={S.tabHeaderRow}>
                    <div>
                      <h2 style={S.tabTitle}>Order Again</h2>
                      <p style={S.tabSubtitle}>Reorder your everyday dark store essentials</p>
                    </div>
                    <div style={S.reorderBadgePill}>
                      <IconClock size={13} color="#0c831f" />
                      <span>Fast 10-Min Reorder</span>
                    </div>
                  </div>

                  {/* Clean, Elegant Empty State */}
                  <ErrorBoundary label="Past Orders" compact onRetry={() => fetchCloudHubState({ force: true })}>
                    {pastOrders.length === 0 ? (
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
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                        {pastOrders.map((po) => {
                          const itemCount = (po.items || []).reduce((s, it) => s + (it.qty || 1), 0);
                          const isOrderDelivered =
                            String(po.status || "").toLowerCase() === "delivered" ||
                            Boolean(po.deliveredAt);
                          return (
                            <div
                              key={po.id || po.orderNumber}
                              style={{
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: 14,
                                padding: 14,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 800, fontSize: 13.5, color: "#0f172a" }}>
                                      Order #{po.orderNumber || po.id}
                                    </span>
                                    {isOrderDelivered ? (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          color: "#15803d",
                                          background: "#dcfce7",
                                          padding: "2px 7px",
                                          borderRadius: 999,
                                        }}
                                      >
                                        ✓ Delivered
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: "#b45309",
                                          background: "#fef3c7",
                                          padding: "2px 7px",
                                          borderRadius: 999,
                                        }}
                                      >
                                        In Progress
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                    {po.placedAt ? new Date(po.placedAt).toLocaleString() : ""} • {itemCount} {itemCount === 1 ? "item" : "items"}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", flexShrink: 0 }}>₹{po.total}</div>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                {(po.items || []).map((it) => (
                                  <div
                                    key={it.sku}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      background: "#f8fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 10,
                                      padding: "6px 10px 6px 6px",
                                      maxWidth: "100%",
                                    }}
                                  >
                                    {it.image && (
                                      <img
                                        src={it.image}
                                        alt={it.name}
                                        style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                                      />
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: "#0f172a",
                                          maxWidth: 150,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {it.name}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#64748b" }}>
                                        Qty {it.qty} • ₹{it.price}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => handleReorderAll(po)}
                                  style={{
                                    flex: 1,
                                    minWidth: 110,
                                    padding: "11px 12px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: "#0c831f",
                                    color: "#ffffff",
                                    fontWeight: 800,
                                    fontSize: 13,
                                    cursor: "pointer",
                                    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.25)",
                                  }}
                                >
                                  🛒 Reorder All
                                </button>
                                {isOrderDelivered ? (
                                  <button
                                    type="button"
                                    onClick={() => downloadDeliverySlipPdf(order)}
                                    style={{
                                      padding: "7px 11px",
                                      borderRadius: 8,
                                      border: "1px solid #86efac",
                                      background: "#f0fdf4",
                                      color: "#15803d",
                                      fontWeight: 800,
                                      fontSize: 11.5,
                                      whiteSpace: "nowrap",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                    title="Download delivery slip (PDF)"
                                  >
                                    📥 Download Slip
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ErrorBoundary>
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
                        desc: "Beatss, Melody, Kopiko, Boomer, Eclairs, Candyman & more varieties in warehouse",
                        count: `${effectiveCatalog.filter((c) => c.category === "Chocolates").length} items`,
                        bg: "#FEF3C7",
                        accent: "#92400E",
                      },
                      {
                        name: "Frames",
                        tag: "In Warehouse",
                        desc: "Kantara, D Boss, Yash KGF, Mahadev, Coding, Anime & A4 Glass Frames",
                        count: `${effectiveCatalog.filter((c) => c.category === "Frames").length} items`,
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
                        SOON
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
                      src={MERGED_BACKGROUND_VIDEOS[bgVideoIdx].src}
                      autoPlay
                      muted
                      playsInline
                      preload="metadata"
                      style={S.mergedBgVideoElement}
                      onError={(e) => {
                        const fb = MERGED_BACKGROUND_VIDEOS[bgVideoIdx]?.fallback;
                        if (fb && e.target.src !== fb) {
                          e.target.src = fb;
                          e.target.play().catch(() => { });
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
                                  el.play().catch(() => { });
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
                                  e.target.play().catch(() => { });
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

                  {/* ── 5. EXPRESS DELIVERY HIGHLIGHTS ── */}
                  <div style={{ marginTop: 10 }}>
                    <div style={S.sectionHeadingRow}>
                      <h3 style={S.sectionSubTitle}>Express delivery</h3>
                      <span style={S.sectionSubCount}>Local store</span>
                    </div>
                    <div style={S.tipturHighlightsGrid}>
                      <div style={S.tipturHighlightCard}>
                        <div style={S.highlightIconWrapper}>
                          <IconShieldCheck size={18} color="#0c831f" />
                        </div>
                        <div>
                          <h4 style={S.highlightTitle}>Fresh local sourcing</h4>
                        </div>
                      </div>

                      <div style={S.tipturHighlightCard}>
                        <div style={S.highlightIconWrapper}>
                          <IconLightning size={18} color="#d97706" />
                        </div>
                        <div>
                          <h4 style={S.highlightTitle}>10-min delivery</h4>
                        </div>
                      </div>

                      <div style={S.tipturHighlightCard}>
                        <div style={S.highlightIconWrapper}>
                          <IconMapPin size={18} color="#2563eb" />
                        </div>
                        <div>
                          <h4 style={S.highlightTitle}>Tiptur local dispatch</h4>
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
                          {!isStoreOpen ? "Store closed • Saved for when store opens" : `Delivery in 10 mins to ${selectedAddress.type}`}
                        </div>
                      </div>
                    </div>

                    {hasOngoingOrder ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          style={{
                            ...S.floatingViewCartCTA,
                            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            padding: "7px 10px",
                            fontSize: 11,
                          }}
                          onClick={() => {
                            const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                            router.push(`/track/${ordId}`);
                          }}
                          title="Delivery ongoing. Click to track."
                        >
                          <span>🛵 Track Live</span>
                        </button>
                        <button
                          type="button"
                          style={{ ...S.floatingViewCartCTA, padding: "7px 12px" }}
                          onClick={() => setIsCheckoutView(true)}
                        >
                          <span>Cart ({totalItems})</span>
                          <IconArrowRight size={14} color="#ffffff" />
                        </button>
                      </div>
                    ) : !isStoreOpen ? (
                      <button
                        type="button"
                        style={{
                          ...S.floatingViewCartCTA,
                          background: "#e11d48",
                        }}
                        onClick={() => triggerToast("🛑 Store is closed right now, ordering soon!")}
                      >
                        <span>STORE CLOSED</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={S.floatingViewCartCTA}
                        onClick={() => setIsCheckoutView(true)}
                      >
                        <span>View Cart & Checkout</span>
                        <IconArrowRight size={16} color="#ffffff" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        )}

        {/* ── LIVE FLOATING DELIVERY / HANDOVER / RATING STATUS BAR (DISAPPEARS ONCE RATED) ── */}
        {activeDeliveryOrder &&
          !rateCompleted &&
          !dismissDeliveryBar &&
          !activeDeliveryOrder.customerRatingSubmitted &&
          activeDeliveryOrder.status !== "delivered" &&
          orderingStage !== "delivered" &&
          !isCheckoutView && (
            <div
              id="active-order-floating-bar"
              style={{
                position: "fixed",
                bottom: totalItems > 0 ? 128 : 68,
                left: "50%",
                transform: "translateX(-50%)",
                width: "calc(100% - 24px)",
                maxWidth: 416,
                background:
                  activeDeliveryOrder.status === "delivered" || orderingStage === "delivered"
                    ? "linear-gradient(135deg, #065f46 0%, #047857 100%)"
                    : orderingStage === "rider_arrived"
                      ? "linear-gradient(135deg, #0c831f 0%, #15803d 100%)"
                      : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                borderRadius: 14,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 10px 28px rgba(15, 23, 42, 0.4), 0 0 0 1.5px rgba(34, 197, 94, 0.75)",
                zIndex: 60,
                cursor: "pointer",
                transition: "all 0.25s ease",
              }}
              onClick={() => {
                if (
                  (activeDeliveryOrder.status === "delivered" || orderingStage === "delivered") &&
                  !rateCompleted
                ) {
                  setShowRateOrderModal(true);
                } else {
                  router.push(`/track/${activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId}`);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                {/* Animated scooter delivery badge */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(12, 131, 31, 0.2)",
                    border: "1px solid rgba(12, 131, 31, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <IconRealisticScooter size={22} color="#4ade80" animated={true} />
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 8px #22c55e",
                    }}
                  />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: "#ffffff",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {customFloatingTitle ||
                        (activeDeliveryOrder.status === "delivered" || orderingStage === "delivered"
                          ? "Rate your order"
                          : orderingStage === "rider_arrived"
                            ? "Arrived at doorstep"
                            : orderingStage === "almost_doorstep"
                              ? "Almost at your doorstep"
                              : orderingStage === "packed_assigning"
                                ? "Order packed"
                                : orderingStage === "rider_assigned"
                                  ? "On the way"
                                  : orderingStage === "picking"
                                    ? "Packing your order"
                                    : "On the way")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: pickerDelayMins > 0 && orderingStage === "picking" ? "#ef4444" : "#22c55e",
                        background: pickerDelayMins > 0 && orderingStage === "picking" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.18)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {customFloatingBadge ||
                        (activeDeliveryOrder.status === "delivered" || orderingStage === "delivered"
                          ? "Delivered"
                          : orderingStage === "rider_arrived"
                            ? "Doorstep"
                            : orderingStage === "almost_doorstep"
                              ? `${deliveryCountdownSec}s`
                              : orderingStage === "packed_assigning"
                                ? "Packed"
                                : `${Math.floor(deliveryCountdownSec / 60)}:${deliveryCountdownSec % 60 < 10 ? "0" : ""}${deliveryCountdownSec % 60}`)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {customFloatingSub ||
                      (activeDeliveryOrder.status === "delivered" || orderingStage === "delivered"
                        ? "Tap to rate delivery & items"
                        : orderingStage === "rider_arrived"
                        ? "Delivery Partner is at your doorstep"
                        : orderingStage === "almost_doorstep"
                        ? "Delivery Partner is reaching now"
                        : orderingStage === "packed_assigning"
                        ? "Assigning delivery partner"
                        : orderingStage === "rider_assigned"
                        ? "Delivery Partner is heading to you"
                        : orderingStage === "picking" && pickerDelayMins > 0
                        ? `Picking is taking slightly longer (+${pickerDelayMins} min)`
                        : "Track order")}
                  </div>
                </div>
              </div>

              {/* RATE / VIEW & COMPLAINT Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
                {(activeDeliveryOrder.status === "delivered" || orderingStage === "delivered" || orderingStage === "rider_arrived") && !rateCompleted ? (
                  <button
                    type="button"
                    style={{
                      background: "#f59e0b",
                      color: "#0f172a",
                      border: "none",
                      borderRadius: 8,
                      padding: "7px 13px",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 3px 10px rgba(245, 158, 11, 0.45)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRateOrderModal(true);
                    }}
                  >
                    {activeDeliveryOrder.status === "delivered" || orderingStage === "delivered" ? "⭐ Rate Now" : "⭐ Rate to Deliver"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      style={{
                        background: "rgba(225, 29, 72, 0.2)",
                        color: "#fda4af",
                        border: "1px solid rgba(225, 29, 72, 0.45)",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setComplaintOrderId(activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId);
                        setShowComplaintModal(true);
                      }}
                      title="Need help or have an issue with this order?"
                    >
                      ⚠️ Issue?
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "#0c831f",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: "0 3px 8px rgba(12, 131, 31, 0.4)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/track/${activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId}`);
                      }}
                    >
                      <span>View Details</span>
                      <IconArrowRight size={14} color="#ffffff" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Dismiss delivery status bar"
                  title="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissDeliveryBar(true);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.12)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

        {/* ── RATE THE RIDER & ORDERED ITEMS MODAL IN ORDERING APP ── */}
        {showRateOrderModal && activeDeliveryOrder && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.78)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
            }}
            onClick={() => setShowRateOrderModal(false)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#ffffff",
                borderRadius: 20,
                padding: 20,
                boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
                border: "2px solid #86efac",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      background: "#dcfce7",
                      color: "#15803d",
                      padding: "3px 8px",
                      borderRadius: 6,
                      textTransform: "uppercase",
                    }}
                  >
                    {activeDeliveryOrder.status === "delivered" ? "Doorstep Delivery Completed" : "🛵 Rider at Doorstep • Submit to Complete Delivery"}
                  </span>
                  <h3 style={{ margin: "6px 0 2px", fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                    Rate Rider &amp; Ordered Items
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                    Order #{activeDeliveryOrder.orderNumber || activeDeliveryOrder.id} delivered by Sinchana B R
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRateOrderModal(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "50%",
                    width: 30,
                    height: 30,
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  ✕
                </button>
              </div>

            <form onSubmit={handleSubmitOrderingRating}>
              {/* Delivery Partner Rating */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#dcfce7",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                    }}
                  >
                    🛵
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Delivery Partner</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>AuditX Express</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {[1, 2, 3, 4, 5].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRiderStars(st)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 22,
                        cursor: "pointer",
                        padding: 1,
                        color: st <= riderStars ? "#f59e0b" : "#cbd5e1",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Item Ratings */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  maxHeight: 160,
                  overflowY: "auto",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                  📦 Rate Ordered Items:
                </div>
                {(activeDeliveryOrder.items || []).map((it, idx) => {
                  const key = it.skuId || it.sku || it.name || idx;
                  const val = itemStarsMap[key] ?? 5;
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "5px 0",
                        borderBottom: idx < (activeDeliveryOrder.items || []).length - 1 ? "1px solid #e2e8f0" : "none",
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        {it.name} (x{it.qty || 1})
                      </span>
                      <div style={{ display: "flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setItemStarsMap((prev) => ({ ...prev, [key]: st }))}
                            style={{
                              background: "none",
                              border: "none",
                              fontSize: 18,
                              cursor: "pointer",
                              padding: 1,
                              color: st <= val ? "#f59e0b" : "#cbd5e1",
                            }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="Write a quick note for delivery partner or item quality..."
                value={rateFeedbackText}
                onChange={(e) => setRateFeedbackText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 12.5,
                  marginBottom: 12,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />

              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 13.5,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(12, 131, 31, 0.3)",
                }}
              >
                ⭐ Submit Rating &amp; Complete Delivery
              </button>

              {(activeDeliveryOrder.status === "delivered" || orderingStage === "delivered") && (
                <button
                  type="button"
                  onClick={() => downloadDeliverySlipPdf(activeDeliveryOrder)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #86efac",
                    background: "#f0fdf4",
                    color: "#15803d",
                    fontWeight: 800,
                    fontSize: 13,
                    textAlign: "center",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  title="Download delivery slip (PDF)"
                >
                  📥 Download Delivery Slip (PDF)
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      </IOSMobileShell>

      {/* ═══════════════════════════════════════════════════════════
          6. PAYMENT GATEWAY SELECTION BOTTOM SHEET
          ═══════════════════════════════════════════════════════════ */}
      <IOSBottomSheet
        isOpen={Boolean(showPaymentModal && cartItemsList.length > 0 && grandTotal > 0)}
        onClose={handleCancelPaymentModal}
        title="Select Payment Method"
        subtitle={`Amount Payable: ₹${grandTotal}`}
        detent="large"
      >
        <ErrorBoundary label="Payment Sheet" compact>
          <div style={S.paymentOptionsList}>
            {/* Option 1: Audit'X Demo Wallet (ACTIVE & DEFAULT) */}
            <div
              style={{
                ...S.paymentCardOption,
                ...(selectedPaymentMethod === "wallet" ? S.paymentCardOptionActive : {}),
                border: selectedPaymentMethod === "wallet" ? "2px solid #0c831f" : "1px solid #E2E8F0",
                background: selectedPaymentMethod === "wallet" ? "#f0fdf4" : "#ffffff",
              }}
              onClick={() => setSelectedPaymentMethod("wallet")}
            >
              <div style={S.paymentOptionLeft}>
                <div style={{ flexShrink: 0 }}>
                  <IconRealLogoAuditxWallet size={40} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...S.paymentMethodTitle, color: "#0c831f", fontSize: 14 }}>
                      Audit'X Demo Wallet
                    </span>
                    <span style={S.activeMethodPill}>ACTIVE • DEFAULT</span>
                  </div>
                  <div style={S.paymentMethodSub}>
                    Paid through demo wallet • Balance: ₹{safeNum(customer?.walletBalance, WALLET_LIMIT).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700, marginTop: 2 }}>
                    ⚡ Instant 1-Click Zero Friction Checkout
                  </div>
                </div>
              </div>
              <input
                type="radio"
                name="payment"
                checked={selectedPaymentMethod === "wallet"}
                onChange={() => setSelectedPaymentMethod("wallet")}
                style={{ ...S.radioBtn, accentColor: "#0c831f" }}
              />
            </div>

            {/* SECTION: UPI & DIGITAL APPS */}
            <div style={{ marginTop: 14, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Pay via UPI App
                </span>
                <span style={S.comingSoonHeaderBadge}>COMING SOON</span>
              </div>

              <div style={S.comingSoonMethodsGrid}>
                {[
                  {
                    id: "phonepe",
                    label: "PhonePe",
                    toast: "⚡ PhonePe integration coming soon! Paid through Audit'X Demo Wallet for now.",
                    icon: <IconRealLogoPhonePe size={56} style={{ borderRadius: 15 }} />,
                  },
                  {
                    id: "gpay",
                    label: "Google Pay",
                    toast: "⚡ Google Pay integration coming soon! Paid through Audit'X Demo Wallet for now.",
                    icon: <IconRealLogoGooglePay size={56} style={{ borderRadius: 15 }} />,
                  },
                  {
                    id: "paytm",
                    label: "Paytm",
                    toast: "⚡ Paytm integration coming soon! Paid through Audit'X Demo Wallet for now.",
                    icon: <IconRealLogoPaytm size={56} style={{ borderRadius: 15 }} />,
                  },
                  {
                    id: "upi",
                    label: "UPI",
                    toast: "⚡ NPCI UPI integration coming soon! Paid through Audit'X Demo Wallet for now.",
                    icon: <IconRealLogoUPI size={56} style={{ borderRadius: 15 }} />,
                  },
                ].map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    style={S.comingSoonMethodCard}
                    onClick={() => triggerToast(app.toast)}
                  >
                    <div style={S.comingSoonLogoWrap}>{app.icon}</div>
                    <span style={S.comingSoonMethodName}>{app.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION: CARDS & COD */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Other Payment Methods
                </span>
              </div>

              {/* Cards (Coming Soon) */}
              <div
                style={{ ...S.paymentCardOption, opacity: 0.75, cursor: "not-allowed", marginBottom: 8 }}
                onClick={() => triggerToast("⚡ Card payments coming soon! Paid through Audit'X Demo Wallet for now.")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconCreditCard size={20} color="#64748b" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>Saved Credit / Debit Cards</div>
                    <div style={S.paymentMethodSub}>Visa, MasterCard, RuPay</div>
                  </div>
                </div>
                <span style={S.comingSoonSmallPill}>Coming Soon</span>
              </div>

              {/* Cash on Delivery */}
              <div
                style={{
                  ...S.paymentCardOption,
                  ...(selectedPaymentMethod === "cod" ? S.paymentCardOptionActive : {}),
                }}
                onClick={() => setSelectedPaymentMethod("cod")}
              >
                <div style={S.paymentOptionLeft}>
                  <div style={S.paymentIconBadge}>
                    <IconCash size={20} color="#0c831f" />
                  </div>
                  <div>
                    <div style={S.paymentMethodTitle}>Cash on Delivery (COD)</div>
                    <div style={S.paymentMethodSub}>Pay cash at your doorstep in Tiptur</div>
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
          </div>

          <div style={S.modalFooterCTA}>
            {hasOngoingOrder ? (
              <div style={{ width: "100%", textAlign: "center" }}>
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 8,
                    color: "#92400e",
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  ⚠️ Order #{ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id} is actively in transit. New orders cannot be placed at the same time.
                </div>
                <button
                  type="button"
                  style={{
                    ...S.confirmPayBtn,
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  }}
                  onClick={() => {
                    setShowPaymentModal(false);
                    const ordId = ongoingTrackedOrder.orderNumber || ongoingTrackedOrder.id || ongoingTrackedOrder.orderId;
                    router.push(`/track/${ordId}`);
                  }}
                >
                  <span>🛵 TRACK ACTIVE ORDER →</span>
                </button>
              </div>
            ) : (cartItemsList.length === 0 || grandTotal <= 0) ? (
              <button
                type="button"
                style={{
                  ...S.confirmPayBtn,
                  background: "#0c831f",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setShowPaymentModal(false);
                  setIsCheckoutView(false);
                }}
              >
                <span>🛍️ Cart is Empty — Add Items</span>
                <IconArrowRight size={18} color="#ffffff" />
              </button>
            ) : (
              <button
                type="button"
                style={S.confirmPayBtn}
                onClick={handleFinalOrderPlacement}
                disabled={placingOrder || !isOnline || grandTotal <= 0}
              >
                <span>
                  {!isOnline
                    ? "Offline — reconnect to pay"
                    : placingOrder
                      ? "Placing order..."
                      : `Pay ₹${grandTotal} (${selectedPaymentMethod === "wallet" ? "Wallet" : "Cash on Delivery"})`}
                </span>
                <IconArrowRight size={18} color="#ffffff" />
              </button>
            )}
          </div>
        </ErrorBoundary>
      </IOSBottomSheet>

      {/* ═══════════════════════════════════════════════════════════
          CUSTOMER PROFILE BOTTOM SHEET
          ═══════════════════════════════════════════════════════════ */}
      <IOSBottomSheet
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Customer Account"
        subtitle="AUDIT'X Hub KA44"
        detent="medium"
      >
        <div>

          {/* Profile Hero Card */}
          <div style={S.profileHeroCard}>
            <div style={S.profileHeroAvatar}>
              {customer?.name ? customer.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={S.profileHeroInfo}>
              <div style={{ ...S.profileHeroName, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{customer?.name || "Customer"}</span>
                <span
                  title="Verified customer"
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#dcfce7",
                  }}
                >
                  <IconCheck size={10} color="#0c831f" />
                </span>
              </div>
              <div style={S.profileHeroInfo}>
                <div style={{ ...S.profileHeroName, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{customer?.name || "Customer"}</span>
                  <span
                    title="Verified customer"
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#dcfce7",
                    }}
                  >
                    <IconCheck size={10} color="#0c831f" />
                  </span>
                </div>
                <div style={S.profileHeroPhone}>{customer?.email || "Google Account"}</div>
              </div>
            </div>
          </div>

          {/* Delivery Location Display (single concise address line) */}
          <div style={S.profileSectionBox}>
            <div style={S.profileSectionHeading}>
              <IconMapPin size={14} color="#0c831f" />
              <span>Delivery location</span>
            </div>
            <div style={S.profileAddressText}>
              <b style={{ color: "#0f172a" }}>KFGSC Campus, Tiptur 572201</b>
            </div>
          </div>

          {/* Compact Wallet Row */}
          <div style={S.profileStatsRow}>
            <div style={S.profileStatCol}>
              <span style={S.statLabel}>Wallet</span>
              <span style={S.statValue}>₹{safeNum(customer?.walletBalance, WALLET_LIMIT).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={S.profileActionsCol}>
            <button
              type="button"
              style={{ ...S.profileEditBtn, minHeight: 44 }}
              onClick={() => {
                setShowProfileModal(false);
                setShowLoginModal(true);
              }}
            >
              <span>Switch account</span>
              <IconArrowRight size={14} color="#0c831f" />
            </button>

            <button
              type="button"
              style={{ ...S.profileLogoutBtn, minHeight: 44 }}
              onClick={() => {
                safeStorage.remove("auditx_customer");
                safeStorage.remove("blinkit_customer");
                safeStorage.remove("auditx_customer_last_order");
                safeStorage.remove("auditx_ordering_cart");
                safeStorage.remove("auditx_ordering_cart_prices");
                safeStorage.remove("auditx_ordering_checkout_step");
                safeStorage.remove("auditx_dismissed_track_order");
                safeStorage.remove("auditx_dismissed_slip_banner");
                safeStorage.remove("auditx_current_customer_email");
                safeStorage.remove("auditx_play_team_intro_once", "session");
                safeStorage.remove("auditx_play_team_intro_once", "local");
                safeStorage.remove("dfx-seen", "session");
                safeStorage.remove("dfx-seen", "local");
                try {
                  sessionStorage.removeItem("dfx-seen");
                  localStorage.removeItem("dfx-seen");
                } catch {}
                setPastOrders([]);
                setCart({});
                cartRef.current = {};
                cartPriceSnapshotRef.current = {};
                setActiveDeliveryOrder(null);
                setLatestDeliveredSlipOrder(null);
                setIsCheckoutView(false);
                setCustomer(null);
                setShowProfileModal(false);
                triggerToast("Logged out successfully.");
                router.replace("/ordering/login");
              }}
            >
              <span>Log out</span>
            </button>
          </div>
        </div>
      </IOSBottomSheet>

      {/* ═══════════════════════════════════════════════════════════
          CUSTOMER LOGIN MODAL (GOOGLE OAUTH)
          ═══════════════════════════════════════════════════════════ */}
      <IOSBottomSheet
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Customer Sign In"
        subtitle="AUDIT'X Dark Store • KFGSC Tiptur 572201"
        detent="medium"
      >
        {loginError && (
          <div style={S.loginErrorBanner}>{loginError}</div>
        )}

        <div style={{ padding: "8px 0 4px 0" }}>
          <div style={{ marginBottom: 4 }}>
            <GoogleAuthButton
              context="ordering"
              roleCode="CUSTOMER"
              variant="small-bar"
              size="medium"
              label="Sign in with Google"
              theme="light"
              onSuccess={(authData) => {
                if (authData?.name) {
                  const custObj = authData.customer || {
                    customerId: `google_${authData.email ? authData.email.replace(/[^a-zA-Z0-9]/g, "_") : Date.now()}`,
                    name: authData.name,
                    email: authData.email || "",
                    picture: authData.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
                    phone: "9845112233",
                    location: "KFGSC , Tiptur 572201",
                    walletBalance: 1000000,
                    provider: "google",
                    loginMethod: "Official Google OAuth 2.0",
                    verifiedAt: new Date().toISOString(),
                  };
                  setCustomer(custObj);
                  setShowLoginModal(false);
                  DiwaliTheme.triggerGreetingOnceToday();
                  triggerTeamIntroOnce();
                  triggerToast(`Welcome, ${authData.name}! Signed in with Google.`);
                }
              }}
            />
          </div>
        </div>
      </IOSBottomSheet>

      {/* ═══════════════════════════════════════════════════════════
          ADDRESS SELECTOR / SWITCHER BOTTOM SHEET
          ═══════════════════════════════════════════════════════════ */}
      <IOSBottomSheet
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Choose Delivery Address"
        subtitle="Fulfilled directly from Dark Store Facility"
        detent="medium"
      >

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

        {/* Custom Address Input + Safe Geolocation Fallback */}
        <div style={S.customAddressBox}>
          <input
            type="text"
            placeholder="Or type custom street / landmark in Tiptur..."
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
                  address: `${customAddressInput.trim()}, Tiptur 572201`,
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
        <button
          type="button"
          onClick={() => {
            if (typeof navigator === "undefined" || !navigator.geolocation) {
              triggerToast("GPS unavailable on this browser — type your address above.");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const lat = pos?.coords?.latitude?.toFixed?.(4);
                const lng = pos?.coords?.longitude?.toFixed?.(4);
                const gpsAddr = {
                  id: `gps_${Date.now()}`,
                  type: "Current",
                  title: "Current GPS Location",
                  flat: "PIN 572201",
                  address: lat && lng ? `GPS (${lat}, ${lng}), Tiptur 572201` : "KFGSC , Tiptur 572201",
                  tag: "GPS",
                  iconType: "other",
                };
                setSelectedAddress(gpsAddr);
                setShowAddressModal(false);
                triggerToast("Delivery location set via GPS.");
              },
              () => {
                triggerToast("Location permission denied — type your street or landmark above.");
              },
              { timeout: 6000, maximumAge: 60000 }
            );
          }}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid var(--ios-sep)",
            background: "var(--ios-fill-secondary)",
            color: "#0C831F",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          📍 Use Current Location (or type above)
        </button>
      </IOSBottomSheet>

      {/* ═══════════════════════════════════════════════════════════
          COUPONS & OFFERS BOTTOM SHEET
          ═══════════════════════════════════════════════════════════ */}
      <IOSBottomSheet
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        title="Available Coupons & Offers"
        subtitle="Apply voucher for instant dark store savings"
        detent="medium"
      >

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
      </IOSBottomSheet>

      {/* Coming Soon Fullscreen Image Modal */}
      {showComingSoonModal && (
        <div style={S.comingSoonModalOverlay} onClick={() => setShowComingSoonModal(false)}>
          <div style={S.comingSoonModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.comingSoonModalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.2rem" }}>📢</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>Groceries Coming Soon in Namma Tiptur KA 44</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>AUDIT'X Dark Store Operations (572201)</div>
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

      {/* ── CUSTOMER SUPPORT & COMPLAINTS DESK MODAL (BHASKAR N S & DEEPU B RESOLUTION) ── */}
      {showComplaintModal && (
        <div
          id="customer-complaint-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9998,
          }}
          onClick={() => setShowComplaintModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: 22,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.28)",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div
              style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#e11d48",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  ⚠️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Customer Helpdesk &amp; Complaints</h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                    Live Hub Resolution with SM Bhaskar N S &amp; ASM Deepu B
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowComplaintModal(false)}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  color: "#ffffff",
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                padding: "4px 8px 0",
              }}
            >
              <button
                type="button"
                onClick={() => setComplaintsTab("tickets")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "none",
                  background: complaintsTab === "tickets" ? "#ffffff" : "transparent",
                  borderBottom: complaintsTab === "tickets" ? "3px solid #0c831f" : "3px solid transparent",
                  fontWeight: complaintsTab === "tickets" ? 800 : 600,
                  fontSize: 12.5,
                  color: complaintsTab === "tickets" ? "#0c831f" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span>📋 My Tickets &amp; Resolutions</span>
                {customerComplaints.length > 0 && (
                  <span
                    style={{
                      background: complaintsTab === "tickets" ? "#0c831f" : "#cbd5e1",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "1px 6px",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {customerComplaints.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setComplaintsTab("raise")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "none",
                  background: complaintsTab === "raise" ? "#ffffff" : "transparent",
                  borderBottom: complaintsTab === "raise" ? "3px solid #e11d48" : "3px solid transparent",
                  fontWeight: complaintsTab === "raise" ? 800 : 600,
                  fontSize: 12.5,
                  color: complaintsTab === "raise" ? "#e11d48" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span>➕ Raise New Complaint</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              {complaintsTab === "raise" ? (
                /* TAB 1: RAISE COMPLAINT FORM */
                <form onSubmit={handleFileComplaint} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div
                    style={{
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 11.5,
                      color: "#9f1239",
                      lineHeight: 1.45,
                    }}
                  >
                    Issues reported here go directly to our store team for fast resolution.
                  </div>

                  {/* Order Reference */}
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Order ID Reference:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ORD-KA44-8921"
                      value={complaintOrderId}
                      onChange={(e) => setComplaintOrderId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        fontWeight: 600,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {activeDeliveryOrder && (
                      <button
                        type="button"
                        onClick={() => setComplaintOrderId(activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0c831f",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: "4px 0 0",
                          textDecoration: "underline",
                        }}
                      >
                        ⚡ Use Active Order ({activeDeliveryOrder.orderNumber || activeDeliveryOrder.id || activeDeliveryOrder.orderId})
                      </button>
                    )}
                  </div>

                  {/* Issue Category */}
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Complaint Category:
                    </label>
                    <select
                      value={complaintCategory}
                      onChange={(e) => setComplaintCategory(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="Missing Item">Missing Item in Delivery Bag</option>
                      <option value="Damaged Goods">Damaged / Melted Packaging</option>
                      <option value="Delivery Delay">Delivery delay</option>
                      <option value="Wrong Item Received">Wrong Item Received</option>
                      <option value="Billing / Wallet Issue">Billing / Wallet Issue</option>
                      <option value="Quality Issue">Quality / Freshness Issue</option>
                      <option value="Other Operations Issue">Other Operations Issue</option>
                    </select>
                  </div>

                  {/* Detailed Description */}
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Explain What Went Wrong:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Received the delivery, but 1x Beatss Milk Chocolate was missing from the bag. Please refund or replace."
                      value={complaintText}
                      onChange={(e) => setComplaintText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                        fontFamily: "inherit",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Refund Amount Requested */}
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Compensation / Refund Amount Requested (₹):
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 50"
                      value={complaintRefundAmount}
                      onChange={(e) => setComplaintRefundAmount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        fontWeight: 600,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ fontSize: 10.5, color: "#64748b", marginTop: 3, display: "block" }}>
                      Approved refunds are credited directly to your Audit'X Demo Wallet.
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={complaintSubmitting || !complaintText.trim()}
                    style={{
                      background: complaintText.trim() ? "linear-gradient(135deg, #e11d48 0%, #be123c 100%)" : "#cbd5e1",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 18px",
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: complaintText.trim() ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: complaintText.trim() ? "0 4px 14px rgba(225, 29, 72, 0.35)" : "none",
                      marginTop: 4,
                    }}
                  >
                    <span>⚠️ Submit Complaint to Store Manager</span>
                  </button>
                </form>
              ) : (
                /* TAB 2: MY TICKETS & SM / ASM LIVE RESOLUTIONS */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {customerComplaints.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
                      <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🎉</span>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>No Complaints on Record</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        All orders delivered on time!
                      </div>
                    </div>
                  ) : (
                    customerComplaints.map((c) => {
                      const isResolved = c.status === "RESOLVED" || c.status === "REPLACEMENT_DISPATCHED";
                      return (
                        <div
                          key={c.id}
                          style={{
                            background: isResolved ? "#f0fdf4" : "#fffbeb",
                            border: isResolved ? "1.5px solid #86efac" : "1.5px solid #fde68a",
                            borderRadius: 14,
                            padding: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {/* Ticket Header Row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 900, fontSize: 13, color: "#0f172a" }}>
                                #{c.id}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                                • Ref: {c.orderId || "ORD-STORE"}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: isResolved ? "#22c55e" : "#f59e0b",
                                color: "#ffffff",
                              }}
                            >
                              {c.status === "RESOLVED" ? "✅ RESOLVED" : c.status === "REPLACEMENT_DISPATCHED" ? "🚀 REPLACEMENT SENT" : "⏳ UNDER SM REVIEW"}
                            </span>
                          </div>

                          {/* Customer Issue */}
                          <div style={{ fontSize: 12.5, color: "#334155", fontWeight: 600 }}>
                            <span style={{ color: "#64748b", fontWeight: 700 }}>Issue: </span>
                            {c.issue}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                            <span>📁 {c.category || "Order Issue"}</span>
                            {c.amount > 0 && <span>💰 Requested: ₹{c.amount}</span>}
                            <span>⏱️ {c.time || "Recently"}</span>
                          </div>

                          {/* LIVE STORE MANAGER / ASM RESOLUTION RESPONSE */}
                          {isResolved ? (
                            <div
                              style={{
                                marginTop: 6,
                                background: "#ffffff",
                                border: "1px solid #bbf7d0",
                                borderRadius: 10,
                                padding: "10px 12px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#15803d", marginBottom: 3 }}>
                                <span>🟢 Store Management Response:</span>
                                <span style={{ color: "#047857" }}>by {c.resolvedBy || "Bhaskar N S (SM)"}</span>
                              </div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                                {c.response || `Complaint verified and resolved with full compensation by Store Manager.`}
                              </div>
                              {c.resolvedAt && (
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                                  Resolved At: {c.resolvedAt}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              style={{
                                marginTop: 4,
                                background: "#fef3c7",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 11,
                                color: "#92400e",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span style={{ animation: "pulse 1.5s infinite" }}>⏳</span>
                              <span>Assigned to Store Manager <b>Bhaskar N S</b> &amp; ASM <b>Deepu B</b>. Under 5-min review.</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  <button
                    type="button"
                    onClick={() => setComplaintsTab("raise")}
                    style={{
                      background: "#f1f5f9",
                      border: "1px dashed #94a3b8",
                      borderRadius: 12,
                      padding: "10px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#475569",
                      cursor: "pointer",
                      marginTop: 4,
                    }}
                  >
                    ➕ Need to report another issue? Click here
                  </button>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div
              style={{
                padding: "12px 18px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: "#64748b" }}>
                AUDIT'X Operations Desk
              </span>
              <button
                type="button"
                onClick={() => setShowComplaintModal(false)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── RAG-BASED EMBEDDED AI ASSISTANT: AUDIT'X Mini ── */}
      {!showIntroOverlay && (
        <AuditxMiniAssistant isStoreOpen={isStoreOpen} customer={customer} />
      )}

      {/* ── INTERACTIVE LITTLE PENGUIN OVERLAY (Always active and looping) ── */}
      {authChecked && customer && !capacityBlockedMsg && !showIntroOverlay && (
        <LittlePenguin rootSelector="#ax-ordering-shell" pos="left" ground={60} scale={1} awaySeconds={12} />
      )}
    </>
  );
}

// ── AUTHENTIC BLINKIT COLOR PALETTE & DESIGN SYSTEM (CLEAN REAL UI THEME) ──
const S = {
  pageWrapper: {
    minHeight: "100vh",
    width: "100%",
    background: "#080C14",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
    color: "#0F172A",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
  },
  mobileShell: {
    width: "100%",
    maxWidth: 440,
    minHeight: "100dvh",
    background: "#F4F6FB",
    position: "relative",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
  },

  // ── STORE CLOSED SCREEN STYLES (BHASKAR N S STORE MANAGER TOGGLE) ──
  storeClosedMain: {
    padding: "24px 16px 48px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 160px)",
  },
  storeClosedCard: {
    width: "100%",
    maxWidth: 400,
    background: "#ffffff",
    borderRadius: 22,
    padding: "30px 22px",
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
    border: "1px solid #fee2e2",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  closedIllustrationWrap: {
    position: "relative",
    marginBottom: 16,
  },
  closedIconCircle: {
    width: 92,
    height: 92,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
    border: "3px solid #fca5a5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 8px 24px rgba(239, 68, 68, 0.25)",
  },
  closedLockBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    fontSize: 22,
    background: "#ef4444",
    borderRadius: "50%",
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #ffffff",
    boxShadow: "0 3px 8px rgba(0, 0, 0, 0.25)",
  },
  closedHeading: {
    fontSize: 22,
    fontWeight: 900,
    color: "#b91c1c",
    lineHeight: 1.3,
    margin: "0 0 12px",
    letterSpacing: "-0.5px",
  },
  closedSubHeading: {
    fontSize: 13.5,
    color: "#475569",
    lineHeight: 1.55,
    margin: "0 0 16px",
  },
  closedStatusBanner: {
    width: "100%",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 12,
    color: "#991b1b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  closedStatusDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#ef4444",
    boxShadow: "0 0 8px #ef4444",
    flexShrink: 0,
  },
  closedCartNotice: {
    width: "100%",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    marginBottom: 16,
  },
  closedActionsRow: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    marginBottom: 20,
  },
  checkStatusBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "13px 20px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.35)",
    transition: "transform 0.15s ease",
  },
  viewDeliveryBtn: {
    width: "100%",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "12px 20px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  closedInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    width: "100%",
    borderTop: "1px solid #f1f5f9",
    paddingTop: 16,
  },
  closedInfoCard: {
    background: "#f8fafc",
    borderRadius: 10,
    padding: "10px 14px",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e2e8f0",
  },
  closedInfoIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  closedInfoTitle: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#1e293b",
  },
  closedInfoDesc: {
    fontSize: 11,
    color: "#64748b",
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
    fontWeight: 600,
    color: "var(--ios-label, #1E293B)",
    margin: 0,
    lineHeight: 1.3,
  },
  itemWeight: {
    fontSize: 11,
    color: "var(--ios-label-2, #64748B)",
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
    color: "var(--ios-label, #0F172A)",
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
  framesHandlingBadge: {
    fontSize: 10,
    color: "#4338CA",
    background: "#EEF2FF",
    padding: "1px 6px",
    borderRadius: 4,
    fontWeight: 800,
    marginLeft: 4,
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
    paddingBottom: 88,
  },
  catalogContainer: {
    width: "100%",
    padding: "10px 12px 96px",
    boxSizing: "border-box",
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchFieldWrapper: {
    background: "var(--ios-fill-secondary)",
    border: "0.5px solid var(--ios-sep)",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    backdropFilter: "blur(12px)",
  },
  searchInput: {
    border: "none",
    outline: "none",
    fontSize: 16,
    color: "var(--ios-label)",
    width: "100%",
    background: "transparent",
    fontWeight: 500,
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
    fontWeight: 600,
    color: "var(--ios-label, #1E293B)",
    lineHeight: 1.3,
    margin: "0 0 2px",
    height: 32,
    overflow: "hidden",
  },
  productWeight: {
    fontSize: 11,
    color: "var(--ios-label-2, #64748B)",
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
    color: "var(--ios-label, #0F172A)",
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
    bottom: "calc(58px + env(safe-area-inset-bottom, 0px))",
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
  activeMethodPill: {
    fontSize: 9,
    fontWeight: 900,
    background: "#dcfce7",
    color: "#166534",
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: "0.5px",
  },
  comingSoonHeaderBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: "#fef3c7",
    color: "#b45309",
    padding: "2px 8px",
    borderRadius: 10,
    letterSpacing: "0.4px",
  },
  comingSoonMethodsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    textAlign: "center",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "14px 10px",
  },
  comingSoonMethodCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 7,
    padding: "4px 2px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "transform 0.12s ease",
  },
  comingSoonLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  comingSoonMethodInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 0,
  },
  comingSoonMethodName: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  comingSoonSmallPill: {
    fontSize: 9,
    fontWeight: 800,
    background: "#f1f5f9",
    color: "#64748b",
    padding: "1px 5px",
    borderRadius: 4,
    alignSelf: "flex-start",
    letterSpacing: "0.3px",
    textTransform: "uppercase",
  },
  changeLinkBtn: {
    background: "none",
    border: "none",
    color: "#0c831f",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
  selectedPaymentMethodRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    background: "#f0fdf4",
    border: "1.5px solid #bbf7d0",
    borderRadius: 10,
    cursor: "pointer",
  },
  paymentMethodLeftPreview: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  paymentMethodSelectedTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0c831f",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  paymentMethodSelectedSub: {
    fontSize: 11,
    color: "#166534",
    marginTop: 2,
  },
  oneClickPill: {
    fontSize: 9,
    fontWeight: 900,
    background: "#0c831f",
    color: "#ffffff",
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: "0.4px",
  },
  paymentMethodCheckActive: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
