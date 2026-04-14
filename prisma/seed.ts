import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

interface CategorySeed {
  code: string;
  name: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  type: TransactionType;
}

const categories: CategorySeed[] = [
  // ── EXPENSE ──────────────────────────────────────────────────────────────
  {
    code: "expense-food",
    name: "Alimentation & Resto",
    nameEn: "Food & Dining",
    nameAr: "المطاعم والتغذية",
    icon: "UtensilsCrossed",
    color: "#F97316",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-housing",
    name: "Logement",
    nameEn: "Housing",
    nameAr: "السكن",
    icon: "Home",
    color: "#D97706",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-health",
    name: "Santé",
    nameEn: "Health",
    nameAr: "الصحة",
    icon: "HeartPulse",
    color: "#EF4444",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-utilities",
    name: "Factures & Services",
    nameEn: "Bills & Utilities",
    nameAr: "الفواتير والخدمات",
    icon: "Zap",
    color: "#F59E0B",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-telecom",
    name: "Télécommunications",
    nameEn: "Telecommunications",
    nameAr: "الاتصالات",
    icon: "Smartphone",
    color: "#FB923C",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-transport",
    name: "Transport",
    nameEn: "Transport",
    nameAr: "المواصلات",
    icon: "Car",
    color: "#3B82F6",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-education",
    name: "Éducation",
    nameEn: "Education",
    nameAr: "التعليم",
    icon: "GraduationCap",
    color: "#6366F1",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-entertainment",
    name: "Loisirs & Culture",
    nameEn: "Entertainment & Culture",
    nameAr: "الترفيه والثقافة",
    icon: "Clapperboard",
    color: "#8B5CF6",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-shopping",
    name: "Shopping & Vêtements",
    nameEn: "Shopping & Clothing",
    nameAr: "التسوق والملابس",
    icon: "ShoppingBag",
    color: "#EC4899",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-travel",
    name: "Voyages",
    nameEn: "Travel",
    nameAr: "السفر",
    icon: "Plane",
    color: "#06B6D4",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-sport",
    name: "Sport & Bien-être",
    nameEn: "Sport & Wellness",
    nameAr: "الرياضة والعافية",
    icon: "Dumbbell",
    color: "#14B8A6",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-family",
    name: "Famille (transferts)",
    nameEn: "Family Transfers",
    nameAr: "التحويلات العائلية",
    icon: "Users",
    color: "#F472B6",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-zakat",
    name: "Zakat & Sadaqa",
    nameEn: "Zakat & Sadaqa",
    nameAr: "الزكاة والصدقة",
    icon: "HeartHandshake",
    color: "#CA8A04",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-gifts",
    name: "Cadeaux offerts",
    nameEn: "Gifts Given",
    nameAr: "الهدايا المقدمة",
    icon: "Gift",
    color: "#A855F7",
    type: TransactionType.EXPENSE,
  },
  {
    code: "expense-other",
    name: "Autres dépenses",
    nameEn: "Other Expenses",
    nameAr: "نفقات أخرى",
    icon: "MoreHorizontal",
    color: "#94A3B8",
    type: TransactionType.EXPENSE,
  },

  // ── INCOME ───────────────────────────────────────────────────────────────
  {
    code: "income-salary",
    name: "Salaire",
    nameEn: "Salary",
    nameAr: "الراتب",
    icon: "Banknote",
    color: "#16A34A",
    type: TransactionType.INCOME,
  },
  {
    code: "income-freelance",
    name: "Freelance",
    nameEn: "Freelance",
    nameAr: "العمل الحر",
    icon: "Laptop",
    color: "#0D9488",
    type: TransactionType.INCOME,
  },
  {
    code: "income-scholarship",
    name: "Bourse",
    nameEn: "Scholarship",
    nameAr: "المنحة الدراسية",
    icon: "BookOpen",
    color: "#0891B2",
    type: TransactionType.INCOME,
  },
  {
    code: "income-gifts",
    name: "Cadeaux reçus",
    nameEn: "Gifts Received",
    nameAr: "الهدايا المستلمة",
    icon: "Gift",
    color: "#22C55E",
    type: TransactionType.INCOME,
  },
  {
    code: "income-refunds",
    name: "Remboursements",
    nameEn: "Refunds",
    nameAr: "المبالغ المستردة",
    icon: "RotateCcw",
    color: "#10B981",
    type: TransactionType.INCOME,
  },
  {
    code: "income-other",
    name: "Autres revenus",
    nameEn: "Other Income",
    nameAr: "إيرادات أخرى",
    icon: "PlusCircle",
    color: "#84CC16",
    type: TransactionType.INCOME,
  },
];

async function main(): Promise<void> {
  console.log("Seeding system categories...");

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        nameEn: cat.nameEn,
        nameAr: cat.nameAr,
        icon: cat.icon,
        color: cat.color,
      },
      create: {
        code: cat.code,
        name: cat.name,
        nameEn: cat.nameEn,
        nameAr: cat.nameAr,
        icon: cat.icon,
        color: cat.color,
        type: cat.type,
        isSystem: true,
        userId: null,
      },
    });
  }

  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
