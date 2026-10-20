import type { Agent, ContractTemplate, Property, Settings } from "@prisma/client";
import { buildContractVars, generateContractPdf } from "./pdf";
import { farBarFormExists, fillFarBarAsIs, resolveContractType } from "./farbar/fill";

export type OfferTerms = {
  offerPrice: number | null;
  earnestMoney: number | null;
  closingDays: number | null;
  inspectionDays: number | null;
  financingType: string | null;
  contingencies: string | null;
  notes: string | null;
  contractType?: string | null;
};

/**
 * Build the offer PDF for a deal using either the built-in custom AS-IS template
 * or the official FAR/BAR AS IS form (when the licensed PDF is present).
 */
export async function generateOfferPdf(input: {
  settings: Settings;
  template: ContractTemplate;
  deal: OfferTerms;
  property: Property;
  agent: Agent | null;
  contractType?: string | null; // explicit override (e.g. bulk builder)
  overrides?: Record<string, string>;
}): Promise<{ bytes: Uint8Array; contractType: "custom" | "farbar"; vars: Record<string, string> }> {
  const { settings, template, deal, property, agent } = input;
  const vars = buildContractVars({ settings, deal, property, agent });
  if (input.overrides) Object.assign(vars, input.overrides);
  const type = resolveContractType(
    [input.contractType, deal.contractType, template.contractType, settings.defaultContractType],
    farBarFormExists(settings.farbarFormPath)
  );
  if (type === "farbar") {
    const bytes = await fillFarBarAsIs(
      {
        ...deal,
        sellerName: property.sellerName,
        property,
        agent: agent ? { name: agent.name, brokerage: agent.brokerage } : null,
        listOfficeName: property.listOfficeName,
      },
      settings
    );
    return { bytes, contractType: "farbar", vars: { ...vars, contractType: "farbar" } };
  }
  const bytes = await generateContractPdf(template.body, vars);
  return { bytes, contractType: "custom", vars: { ...vars, contractType: "custom" } };
}
