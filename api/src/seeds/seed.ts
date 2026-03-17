import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { User } from '../models/User.model';
import { Business } from '../models/Business.model';
import { Product } from '../models/Product.model';
import { GroupPurchase } from '../models/GroupPurchase.model';
import { Participant } from '../models/Participant.model';

const PRODUCT_IMAGES: Record<string, string[]> = {
  airpods: [
    'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&q=80',
    'https://images.unsplash.com/photo-1588423771073-b8903fde1c68?w=800&q=80',
  ],
  tv: [
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
    'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800&q=80',
  ],
  coffee: [
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  ],
  sneakers: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
  ],
  yoga: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  ],
  robot: [
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&q=80',
    'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=800&q=80',
  ],
  sofa: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
  ],
  watch: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&q=80',
  ],
  olive_oil: [
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80',
    'https://images.unsplash.com/photo-1612622295023-95980d49e55c?w=800&q=80',
  ],
  camping: [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  ],
};

export async function seedDatabase() {
  console.log('Seeding database...');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    Product.deleteMany({}),
    GroupPurchase.deleteMany({}),
    Participant.deleteMany({}),
  ]);

  const hashedPassword = await bcrypt.hash('123456', 10);

  // Create business users
  const businessUsers = await User.insertMany([
    {
      firstName: 'אלקטרו',
      lastName: 'סטור',
      email: 'electro@demo.com',
      phone: '0501111111',
      password: hashedPassword,
      location: 'תל אביב',
      role: 'business',
      referralCode: uuidv4().slice(0, 8),
    },
    {
      firstName: 'סטייל',
      lastName: 'שופ',
      email: 'style@demo.com',
      phone: '0502222222',
      password: hashedPassword,
      location: 'חיפה',
      role: 'business',
      referralCode: uuidv4().slice(0, 8),
    },
    {
      firstName: 'בית',
      lastName: 'ועוד',
      email: 'home@demo.com',
      phone: '0503333333',
      password: hashedPassword,
      location: 'ירושלים',
      role: 'business',
      referralCode: uuidv4().slice(0, 8),
    },
    {
      firstName: 'ספורט',
      lastName: 'פלוס',
      email: 'sport@demo.com',
      phone: '0504444444',
      password: hashedPassword,
      location: 'באר שבע',
      role: 'business',
      referralCode: uuidv4().slice(0, 8),
    },
    {
      firstName: 'טעמים',
      lastName: 'מהטבע',
      email: 'food@demo.com',
      phone: '0505555555',
      password: hashedPassword,
      location: 'רמת גן',
      role: 'business',
      referralCode: uuidv4().slice(0, 8),
    },
  ]);

  // Create a regular demo user
  await User.create({
    firstName: 'משתמש',
    lastName: 'דמו',
    email: 'demo@demo.com',
    phone: '0509999999',
    password: hashedPassword,
    location: 'תל אביב',
    role: 'user',
    referralCode: uuidv4().slice(0, 8),
  });

  // Create businesses
  const businesses = await Business.insertMany([
    {
      userId: businessUsers[0]._id,
      businessName: 'אלקטרו סטור',
      description: 'החנות המובילה למוצרי אלקטרוניקה במחירים הכי משתלמים',
      contactEmail: 'electro@demo.com',
      contactPhone: '0501111111',
      logo: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=200&q=80',
      rating: 4.7,
      reviewCount: 128,
      isVerified: true,
    },
    {
      userId: businessUsers[1]._id,
      businessName: 'סטייל שופ',
      description: 'אופנה ואקססוריז במחירי קבוצה',
      contactEmail: 'style@demo.com',
      contactPhone: '0502222222',
      logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80',
      rating: 4.5,
      reviewCount: 87,
      isVerified: true,
    },
    {
      userId: businessUsers[2]._id,
      businessName: 'בית ועוד',
      description: 'ריהוט ופריטים לבית בעיצוב מודרני',
      contactEmail: 'home@demo.com',
      contactPhone: '0503333333',
      logo: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=200&q=80',
      rating: 4.3,
      reviewCount: 56,
      isVerified: true,
    },
    {
      userId: businessUsers[3]._id,
      businessName: 'ספורט פלוס',
      description: 'ציוד ספורט, כושר וטיולים',
      contactEmail: 'sport@demo.com',
      contactPhone: '0504444444',
      logo: 'https://images.unsplash.com/photo-1461896836934-bd45ba8fcaac?w=200&q=80',
      rating: 4.6,
      reviewCount: 92,
      isVerified: true,
    },
    {
      userId: businessUsers[4]._id,
      businessName: 'טעמים מהטבע',
      description: 'מוצרי מזון איכותיים מהחקלאי ישירות אליכם',
      contactEmail: 'food@demo.com',
      contactPhone: '0505555555',
      logo: 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=200&q=80',
      rating: 4.8,
      reviewCount: 203,
      isVerified: true,
    },
  ]);

  const now = new Date();
  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

  // Create products with discount tiers
  const products = await Product.insertMany([
    {
      businessId: businesses[0]._id,
      name: 'אוזניות AirPods Pro 2',
      description: 'אוזניות אלחוטיות עם ביטול רעשים אקטיבי, שמע מרחבי ועמידות למים. כולל כיסוי טעינה MagSafe.',
      images: PRODUCT_IMAGES.airpods,
      category: 'electronics',
      originalPrice: 999,
      priceTiers: [
        { minBuyers: 1, price: 899 },
        { minBuyers: 25, price: 799 },
        { minBuyers: 50, price: 699 },
        { minBuyers: 100, price: 599 },
      ],
      maxBuyers: 200,
      minBuyers: 10,
      deliveryTerms: 'משלוח חינם תוך 5-7 ימי עסקים',
      cancelPolicy: 'ביטול עד 14 יום מקבלת המוצר',
      viewCount: 1247,
    },
    {
      businessId: businesses[0]._id,
      name: 'טלוויזיה 55" 4K Smart TV',
      description: 'טלוויזיה חכמה 55 אינץ\' ברזולוציית 4K Ultra HD, תמיכה ב-HDR10, מערכת הפעלה WebOS.',
      images: PRODUCT_IMAGES.tv,
      category: 'electronics',
      originalPrice: 3499,
      priceTiers: [
        { minBuyers: 1, price: 3199 },
        { minBuyers: 20, price: 2799 },
        { minBuyers: 50, price: 2499 },
        { minBuyers: 100, price: 2199 },
      ],
      maxBuyers: 150,
      minBuyers: 10,
      deliveryTerms: 'משלוח והתקנה חינם תוך 10 ימי עסקים',
      cancelPolicy: 'ביטול תוך 30 יום',
      viewCount: 892,
    },
    {
      businessId: businesses[1]._id,
      name: 'נעלי ספורט Nike Air Max',
      description: 'נעלי ריצה קלות משקל עם טכנולוגיית Air Max לנוחות מרבית. זמין במגוון מידות וצבעים.',
      images: PRODUCT_IMAGES.sneakers,
      category: 'fashion',
      originalPrice: 699,
      priceTiers: [
        { minBuyers: 1, price: 599 },
        { minBuyers: 30, price: 499 },
        { minBuyers: 75, price: 399 },
        { minBuyers: 150, price: 349 },
      ],
      maxBuyers: 300,
      minBuyers: 15,
      deliveryTerms: 'משלוח תוך 7 ימי עסקים',
      cancelPolicy: 'החלפה או החזרה תוך 14 יום',
      viewCount: 2341,
    },
    {
      businessId: businesses[1]._id,
      name: 'שעון חכם פרימיום',
      description: 'שעון חכם עם מסך AMOLED, מד דופק, GPS מובנה, עמידות במים ועוד. סוללה עד 7 ימים.',
      images: PRODUCT_IMAGES.watch,
      category: 'fashion',
      originalPrice: 1299,
      priceTiers: [
        { minBuyers: 1, price: 1149 },
        { minBuyers: 25, price: 999 },
        { minBuyers: 50, price: 849 },
        { minBuyers: 100, price: 749 },
      ],
      maxBuyers: 200,
      minBuyers: 10,
      deliveryTerms: 'משלוח חינם מעל 500 ש"ח',
      cancelPolicy: 'ביטול תוך 14 יום',
      viewCount: 1563,
    },
    {
      businessId: businesses[2]._id,
      name: 'ספה פינתית מעוצבת',
      description: 'ספה פינתית מרווחת בעיצוב מודרני, ריפוד בד איכותי, כולל כריות נוי. זמינה ב-3 צבעים.',
      images: PRODUCT_IMAGES.sofa,
      category: 'home',
      originalPrice: 7999,
      priceTiers: [
        { minBuyers: 1, price: 6999 },
        { minBuyers: 15, price: 5999 },
        { minBuyers: 30, price: 4999 },
        { minBuyers: 50, price: 4499 },
      ],
      maxBuyers: 80,
      minBuyers: 5,
      deliveryTerms: 'הובלה והרכבה חינם תוך 21 ימי עסקים',
      cancelPolicy: 'ביטול עד 14 יום מההזמנה',
      viewCount: 654,
    },
    {
      businessId: businesses[2]._id,
      name: 'מכונת קפה אוטומטית',
      description: 'מכונת אספרסו אוטומטית מלאה עם מטחנה מובנית, הקצפת חלב ומסך מגע. 15 סוגי משקאות.',
      images: PRODUCT_IMAGES.coffee,
      category: 'home',
      originalPrice: 2999,
      priceTiers: [
        { minBuyers: 1, price: 2699 },
        { minBuyers: 25, price: 2399 },
        { minBuyers: 50, price: 1999 },
        { minBuyers: 100, price: 1799 },
      ],
      maxBuyers: 200,
      minBuyers: 10,
      deliveryTerms: 'משלוח חינם + קפסולות מתנה',
      cancelPolicy: 'אחריות יצרן 3 שנים + ביטול 30 יום',
      viewCount: 1876,
    },
    {
      businessId: businesses[3]._id,
      name: 'חבילת יוגה מושלמת',
      description: 'סט מלא ליוגה: מזרן TPE 6 מ"מ, בלוקים, רצועה, תיק נשיאה ומגבת מיקרופייבר.',
      images: PRODUCT_IMAGES.yoga,
      category: 'sports',
      originalPrice: 399,
      priceTiers: [
        { minBuyers: 1, price: 349 },
        { minBuyers: 30, price: 279 },
        { minBuyers: 60, price: 229 },
        { minBuyers: 100, price: 199 },
      ],
      maxBuyers: 250,
      minBuyers: 15,
      deliveryTerms: 'משלוח תוך 5 ימי עסקים',
      cancelPolicy: 'החזרה תוך 14 יום',
      viewCount: 987,
    },
    {
      businessId: businesses[3]._id,
      name: 'אוהל קמפינג משפחתי',
      description: 'אוהל ל-4 אנשים עם עמידות בגשם, רשת נגד יתושים, קל להקמה. כולל תיק נשיאה.',
      images: PRODUCT_IMAGES.camping,
      category: 'sports',
      originalPrice: 1199,
      priceTiers: [
        { minBuyers: 1, price: 999 },
        { minBuyers: 20, price: 849 },
        { minBuyers: 40, price: 749 },
        { minBuyers: 80, price: 649 },
      ],
      maxBuyers: 120,
      minBuyers: 10,
      deliveryTerms: 'משלוח חינם לכל הארץ',
      cancelPolicy: 'החזרה עד 30 יום באריזה מקורית',
      viewCount: 743,
    },
    {
      businessId: businesses[4]._id,
      name: 'שמן זית כתית מעולה - 5 ליטר',
      description: 'שמן זית כתית מעולה מכפר ענאתא, כבישה קרה ראשונה. חומציות 0.3%. ישירות מהמסיק.',
      images: PRODUCT_IMAGES.olive_oil,
      category: 'food',
      originalPrice: 249,
      priceTiers: [
        { minBuyers: 1, price: 219 },
        { minBuyers: 50, price: 179 },
        { minBuyers: 100, price: 149 },
        { minBuyers: 200, price: 129 },
      ],
      maxBuyers: 500,
      minBuyers: 20,
      deliveryTerms: 'איסוף מנקודות חלוקה ברחבי הארץ',
      cancelPolicy: 'ביטול עד סגירת הקבוצה',
      viewCount: 3124,
    },
    {
      businessId: businesses[0]._id,
      name: 'רובוט שואב אבק חכם',
      description: 'רובוט שואב ושוטף עם מיפוי לייזר LiDAR, שליטה באפליקציה, תחנת ריקון אוטומטית.',
      images: PRODUCT_IMAGES.robot,
      category: 'electronics',
      originalPrice: 2499,
      priceTiers: [
        { minBuyers: 1, price: 2199 },
        { minBuyers: 25, price: 1899 },
        { minBuyers: 50, price: 1599 },
        { minBuyers: 100, price: 1399 },
      ],
      maxBuyers: 200,
      minBuyers: 10,
      deliveryTerms: 'משלוח חינם תוך 7 ימי עסקים',
      cancelPolicy: 'אחריות שנתיים + ביטול 14 יום',
      viewCount: 2056,
    },
  ]);

  // Create group purchases with varying participant counts
  const participantCounts = [37, 12, 89, 42, 8, 67, 23, 5, 156, 54];
  const groupPurchases = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const count = participantCounts[i];

    // Calculate current price based on tier
    const sorted = [...(product.priceTiers as any)].sort((a: any, b: any) => b.minBuyers - a.minBuyers);
    let currentPrice = sorted[sorted.length - 1]?.price || product.originalPrice;
    for (const tier of sorted) {
      if (count >= tier.minBuyers) {
        currentPrice = tier.price;
        break;
      }
    }

    const gp = await GroupPurchase.create({
      productId: product._id,
      status: 'open',
      currentPrice,
      participantCount: count,
      startDate: now,
      endDate: new Date(endDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000),
    });

    groupPurchases.push(gp);
  }

  console.log(`Seeded: ${businessUsers.length} business users, ${businesses.length} businesses, ${products.length} products, ${groupPurchases.length} group purchases`);
  console.log('\nDemo login: demo@demo.com / 123456');
  console.log('Business login: electro@demo.com / 123456');

  return { products: products.length, groupPurchases: groupPurchases.length };
}

// Run directly
if (require.main === module) {
  mongoose
    .connect(env.mongodbUri)
    .then(() => seedDatabase())
    .then(() => {
      console.log('Seed complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
