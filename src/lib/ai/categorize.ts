import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CategorizationResult = {
  categoryCode: string;     // e.g. "expense-food"
  confidence: number;       // 0.0 - 1.0
};

// ─── Category list for the prompt ────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { code: "expense-food", description: "Alimentation, restaurants, cafés, courses alimentaires, boulangerie" },
  { code: "expense-housing", description: "Loyer, charges, réparations domicile" },
  { code: "expense-health", description: "Pharmacie, médecin, dentiste, soins de santé" },
  { code: "expense-utilities", description: "Factures eau, électricité, gaz, internet fixe" },
  { code: "expense-telecom", description: "Forfait mobile, recharge téléphone, Inwi, Maroc Telecom, Orange" },
  { code: "expense-transport", description: "Taxi, Careem, tramway, bus, essence, parking, péage" },
  { code: "expense-education", description: "Frais de scolarité, livres, fournitures scolaires, cours" },
  { code: "expense-entertainment", description: "Cinéma, sorties, jeux, loisirs, culture, streaming" },
  { code: "expense-shopping", description: "Vêtements, chaussures, accessoires, électronique, achats divers" },
  { code: "expense-travel", description: "Hôtel, billet d'avion, voyage, hébergement touristique" },
  { code: "expense-sport", description: "Salle de sport, abonnement fitness, équipement sportif" },
  { code: "expense-family", description: "Transfert famille, argent envoyé aux parents, aide familiale" },
  { code: "expense-zakat", description: "Zakat, sadaqa, don caritatif, aumône" },
  { code: "expense-gifts", description: "Cadeaux offerts, anniversaire, mariage" },
  { code: "expense-other", description: "Autres dépenses non classifiées" },
];

const INCOME_CATEGORIES = [
  { code: "income-salary", description: "Salaire mensuel, paie, virement employeur" },
  { code: "income-freelance", description: "Revenu freelance, prestation de service, mission" },
  { code: "income-scholarship", description: "Bourse d'études, aide financière éducation" },
  { code: "income-gifts", description: "Cadeau reçu, argent reçu, don reçu" },
  { code: "income-refunds", description: "Remboursement, retour produit, avoir" },
  { code: "income-other", description: "Autres revenus non classifiés" },
];

// ─── System prompt (cacheable) ───────────────────────────────────────────────

function buildSystemPrompt(type: "INCOME" | "EXPENSE"): string {
  const cats = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catList = cats
    .map((c) => `- ${c.code}: ${c.description}`)
    .join("\n");

  return `Tu es un classificateur de transactions financières pour une application de gestion de finances personnelles au Maroc.

Étant donné la description d'une transaction, tu dois choisir la catégorie la plus appropriée parmi cette liste :

${catList}

Règles :
- Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.
- Format exact : {"code":"<category_code>","confidence":<0.0-1.0>}
- La confidence reflète ta certitude : 0.9+ si la description est claire, 0.5-0.8 si ambiguë, <0.5 si très incertain.
- Si aucune catégorie ne correspond clairement, utilise "${type === "INCOME" ? "income-other" : "expense-other"}" avec une confidence basse.
- Contexte culturel marocain : "Marjane", "Carrefour", "Acima" = courses alimentaires. "Inwi", "IAM", "Orange" = télécom. "Careem" = transport. "Western Union", "transfert parents" = famille.`;
}

// ─── Main function ───────────────────────────────────────────────────────────

const client = new Anthropic();

export async function categorizeTransaction(
  description: string,
  type: "INCOME" | "EXPENSE"
): Promise<CategorizationResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (description.trim().length < 3) return null;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(type),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Transaction (${type}): "${description}"`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : null;
    if (!text) return null;

    // Parse JSON response — strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { code: string; confidence: number };

    // Validate the returned code exists in our list
    const allCodes = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(
      (c) => c.code
    );
    if (!allCodes.includes(parsed.code)) return null;

    return {
      categoryCode: parsed.code,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    };
  } catch {
    // Silently fail — AI categorization is a nice-to-have, not critical
    return null;
  }
}
