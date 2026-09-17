import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FLORIDA_AS_IS_TEMPLATE = `FLORIDA INVESTOR AS-IS PURCHASE OFFER
(Custom Working Template — Not a FAR/BAR Form)

Date: {{offerDate}}

BUYER: {{buyerName}}
Entity: {{buyerEntity}}
Address: {{buyerAddress}}, {{buyerCity}}, {{buyerState}} {{buyerZip}}
Phone: {{buyerPhone}} | Email: {{buyerEmail}}
Authorized Signatory: {{buyerSignatory}}

SELLER / LISTING AGENT:
Agent: {{agentName}}
Brokerage: {{agentBrokerage}}
Email: {{agentEmail}} | Phone: {{agentPhone}}

PROPERTY:
Street: {{propertyAddress}}
City/State/Zip: {{propertyCity}}, {{propertyState}} {{propertyZip}}
MLS #: {{mlsNumber}}
Property Type: {{propertyType}}
Beds/Baths/SqFt: {{beds}} / {{baths}} / {{sqft}}
Year Built: {{yearBuilt}}
Listed Price: {{listPrice}}

OFFER TERMS:
1. Purchase Price: {{offerPrice}}
2. Earnest Money Deposit: {{earnestMoney}} (to be held by Buyer's chosen title/escrow)
3. Financing: {{financingType}}
4. Closing: On or before {{closingDays}} days from Effective Date
5. Inspection Period: {{inspectionDays}} days from Effective Date
6. Property Condition: Buyer is purchasing the Property in its present "AS-IS" condition.
   Buyer may conduct inspections during the Inspection Period and may terminate for any reason
   by written notice before the Inspection Period expires, in which case Earnest Money is returned.
7. Title: Seller shall convey marketable title by Warranty Deed (or Special Warranty Deed if Seller is an entity/estate),
   subject only to standard exceptions and matters of public record that do not materially impair use.
8. Prorations: Taxes, HOA dues (if any), and rents shall be prorated as of Closing.
9. Assignability: This Agreement may be assigned by Buyer to an affiliated entity without Seller consent.
10. Contingencies / Other Terms:
{{contingencies}}

ADDITIONAL NOTES:
{{notes}}

ACKNOWLEDGMENT:
This is a non-binding offer outline generated for investor workflow purposes until executed by both parties
on a mutually agreed purchase agreement. Nothing herein constitutes legal advice.

Buyer Signatory: _______________________________  Date: __________
{{buyerSignatory}} / {{buyerName}}

Seller / Seller's Agent Acknowledgment of Receipt: _______________________________  Date: __________
`;

async function main() {
  console.log("Seeding Prop Hunters investor CRM...");

  await prisma.activity.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.property.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.contractTemplate.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.settings.create({
    data: {
      id: "default",
      buyerName: "Prop Hunters LLC",
      buyerEntity: "Prop Hunters LLC",
      buyerAddress: "100 SE 2nd St",
      buyerCity: "Miami",
      buyerState: "FL",
      buyerZip: "33131",
      buyerEmail: "offers@prophunters.example",
      buyerPhone: "(305) 555-0142",
      buyerSignatory: "Branden",
      defaultEarnest: 1000,
      defaultClosingDays: 30,
      defaultInspectionDays: 10,
    },
  });

  const template = await prisma.contractTemplate.create({
    data: {
      name: "Florida Investor AS-IS Offer",
      description:
        "Custom Prop Hunters-style AS-IS investor offer outline for Florida MLS deals. Not a copyrighted FAR/BAR form.",
      body: FLORIDA_AS_IS_TEMPLATE,
      isDefault: true,
    },
  });

  const agents = await Promise.all([
    prisma.agent.create({
      data: {
        name: "Maria Santos",
        email: "maria.santos@example-realty.com",
        phone: "(954) 555-0101",
        brokerage: "Coastal Florida Realty",
        licenseNo: "BK3123456",
      },
    }),
    prisma.agent.create({
      data: {
        name: "James Okonkwo",
        email: "james.o@sunbeltlistings.example",
        phone: "(305) 555-0188",
        brokerage: "Sunbelt Listings Group",
        licenseNo: "BK2987654",
      },
    }),
    prisma.agent.create({
      data: {
        name: "Lisa Chen",
        email: "lchen@palmkeybrokers.example",
        phone: "(561) 555-0133",
        brokerage: "Palm Key Brokers",
        licenseNo: "BK3456789",
      },
    }),
    prisma.agent.create({
      data: {
        name: "Robert Diaz",
        email: "rdiaz@evergladeshomes.example",
        phone: "(786) 555-0199",
        brokerage: "Everglades Homes",
        licenseNo: "BK3567890",
      },
    }),
  ]);

  const properties = await Promise.all([
    prisma.property.create({
      data: {
        address: "1842 NW 12th Ave",
        city: "Fort Lauderdale",
        state: "FL",
        zip: "33311",
        mlsNumber: "F10489231",
        listPrice: 425000,
        beds: 3,
        baths: 2,
        sqft: 1480,
        yearBuilt: 1968,
        propertyType: "Single Family",
        notes: "Tired kitchen, good bones, possible ADU lot.",
      },
    }),
    prisma.property.create({
      data: {
        address: "9020 SW 152nd St",
        city: "Miami",
        state: "FL",
        zip: "33157",
        mlsNumber: "A11567890",
        listPrice: 389000,
        beds: 4,
        baths: 2,
        sqft: 1720,
        yearBuilt: 1975,
        propertyType: "Single Family",
        notes: "Estate sale feel; needs roof check.",
      },
    }),
    prisma.property.create({
      data: {
        address: "441 Palm Dr",
        city: "West Palm Beach",
        state: "FL",
        zip: "33401",
        mlsNumber: "RX-10987654",
        listPrice: 510000,
        beds: 3,
        baths: 2.5,
        sqft: 1650,
        yearBuilt: 1982,
        propertyType: "Single Family",
        notes: "Near downtown; HOA light.",
      },
    }),
    prisma.property.create({
      data: {
        address: "215 Coral Way #4B",
        city: "Coral Gables",
        state: "FL",
        zip: "33134",
        mlsNumber: "A11654321",
        listPrice: 295000,
        beds: 2,
        baths: 2,
        sqft: 980,
        yearBuilt: 1998,
        propertyType: "Condo",
        notes: "Investor-friendly building; check rental caps.",
      },
    }),
    prisma.property.create({
      data: {
        address: "7780 NW 27th Ave",
        city: "Miami",
        state: "FL",
        zip: "33147",
        mlsNumber: "A11700112",
        listPrice: 355000,
        beds: 3,
        baths: 1,
        sqft: 1210,
        yearBuilt: 1955,
        propertyType: "Single Family",
        notes: "BRRRR candidate; alley access.",
      },
    }),
  ]);

  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        title: "FTL NW 12th — AS-IS offer",
        stage: "offer_drafted",
        offerPrice: 375000,
        earnestMoney: 1000,
        closingDays: 25,
        inspectionDays: 10,
        financingType: "Cash",
        contingencies: "Buyer may assign. Seller to leave all appliances.",
        notes: "Strong comps support mid-370s.",
        propertyId: properties[0].id,
        agentId: agents[0].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: "Miami SW 152nd — researching",
        stage: "researching",
        offerPrice: 340000,
        earnestMoney: 1000,
        closingDays: 30,
        inspectionDays: 10,
        financingType: "Cash",
        propertyId: properties[1].id,
        agentId: agents[1].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: "WPB Palm Dr — sent to agent",
        stage: "sent",
        offerPrice: 465000,
        earnestMoney: 2000,
        closingDays: 30,
        inspectionDays: 7,
        financingType: "Cash",
        contingencies: "Short inspection. Title via Buyer's preferred closer.",
        propertyId: properties[2].id,
        agentId: agents[2].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: "Coral Gables condo — new",
        stage: "new",
        offerPrice: 270000,
        earnestMoney: 1000,
        closingDays: 30,
        inspectionDays: 10,
        financingType: "Cash",
        propertyId: properties[3].id,
        agentId: agents[3].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: "NW 27th Ave BRRRR — negotiating",
        stage: "negotiating",
        offerPrice: 310000,
        earnestMoney: 1500,
        closingDays: 21,
        inspectionDays: 10,
        financingType: "Cash",
        contingencies: "Seller credit for roof TBD.",
        notes: "Counter expected.",
        propertyId: properties[4].id,
        agentId: agents[1].id,
      },
    }),
  ]);

  await prisma.activity.createMany({
    data: [
      {
        dealId: deals[0].id,
        type: "note",
        message: "Pulled comps; drafting AS-IS offer at $375k.",
      },
      {
        dealId: deals[0].id,
        type: "stage_change",
        message: "Stage moved to Offer Drafted",
      },
      {
        dealId: deals[2].id,
        type: "email_sent",
        message: "Offer marked sent to Lisa Chen via mailto preview.",
      },
      {
        dealId: deals[2].id,
        type: "stage_change",
        message: "Stage moved to Sent",
      },
      {
        dealId: deals[4].id,
        type: "note",
        message: "Agent asked for $325k; considering $315k counter.",
      },
      {
        dealId: deals[1].id,
        type: "note",
        message: "Ordering title search snapshot and flood zone check.",
      },
    ],
  });

  // Sample drafted contract on first deal
  await prisma.contract.create({
    data: {
      dealId: deals[0].id,
      templateId: template.id,
      status: "draft",
      filledData: JSON.stringify({
        offerDate: new Date().toLocaleDateString("en-US"),
        offerPrice: "$375,000",
        earnestMoney: "$1,000",
        closingDays: "25",
        inspectionDays: "10",
        financingType: "Cash",
      }),
    },
  });

  console.log("Seed complete:", {
    agents: agents.length,
    properties: properties.length,
    deals: deals.length,
    template: template.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
