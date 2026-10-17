/**
 * Canonical listing import fields + header alias auto-detection.
 * Aliases are compared after normalising: lowercase, letters/digits only.
 * Covers Matrix (Miami Realtors) exports, Reifax-style exports, and generic CSVs.
 */
export type ImportFieldKey =
  | "mlsNumber"
  | "status"
  | "address"
  | "streetNumber"
  | "streetDir"
  | "streetName"
  | "streetSuffix"
  | "unit"
  | "city"
  | "state"
  | "zip"
  | "county"
  | "area"
  | "subdivision"
  | "listPrice"
  | "originalListPrice"
  | "beds"
  | "fullBaths"
  | "halfBaths"
  | "totalBaths"
  | "sqft"
  | "lotSqft"
  | "yearBuilt"
  | "propertyType"
  | "pool"
  | "waterfront"
  | "dom"
  | "listDate"
  | "shortSale"
  | "reo"
  | "remarks"
  | "showingInstructions"
  | "agentName"
  | "agentEmail"
  | "agentPhone"
  | "officeName"
  | "officePhone";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  required?: boolean;
  aliases: string[];
};

export const IMPORT_FIELDS: ImportField[] = [
  { key: "mlsNumber", label: "MLS #", aliases: ["ml#", "mls#", "mlsnumber", "mlsno", "mlsid", "mlnumber", "listingid", "listingnumber", "mls", "ml"] },
  { key: "status", label: "Status", aliases: ["status", "liststatus", "listingstatus", "currentstatus", "mlsstatus"] },
  { key: "address", label: "Address (full street)", required: true, aliases: ["address", "fulladdress", "streetaddress", "propertyaddress", "siteaddress", "listingaddress", "addressline1", "address1", "street"] },
  { key: "streetNumber", label: "Street number", aliases: ["streetnumber", "streetno", "stnum", "housenumber", "streetnum"] },
  { key: "streetDir", label: "Street direction", aliases: ["streetdirprefix", "streetdirection", "streetdir", "predirection", "stdir", "streetdirectionprefix"] },
  { key: "streetName", label: "Street name", aliases: ["streetname", "stname"] },
  { key: "streetSuffix", label: "Street suffix", aliases: ["streetsuffix", "stsuffix", "streettype"] },
  { key: "unit", label: "Unit #", aliases: ["unit", "unit#", "unitnumber", "apt", "aptnumber", "apt#", "suite"] },
  { key: "city", label: "City", aliases: ["city", "postalcity", "propertycity", "citytown"] },
  { key: "state", label: "State", aliases: ["state", "stateorprovince", "st", "propertystate"] },
  { key: "zip", label: "Zip", aliases: ["zip", "zipcode", "postalcode", "zip5", "propertyzip", "postal"] },
  { key: "county", label: "County", aliases: ["county", "countyorparish", "propertycounty"] },
  { key: "area", label: "Area", aliases: ["area", "mlsarea", "marketarea", "areaname", "arearegion"] },
  { key: "subdivision", label: "Subdivision", aliases: ["subdivision", "subdivisionname", "subdiv", "development", "community", "complexcommunityname"] },
  { key: "listPrice", label: "List price", aliases: ["listprice", "currentprice", "price", "askingprice", "lp", "listingprice"] },
  { key: "originalListPrice", label: "Original list price", aliases: ["originallistprice", "origlistprice", "originalprice", "origprice", "olp"] },
  { key: "beds", label: "Beds", aliases: ["beds", "bedrooms", "totalbedrooms", "bedroomstotal", "br", "bdrms", "bed"] },
  { key: "fullBaths", label: "Full baths", aliases: ["fullbaths", "fullbathrooms", "bathsfull", "bathsfull", "fullbath"] },
  { key: "halfBaths", label: "Half baths", aliases: ["halfbaths", "halfbathrooms", "bathshalf", "halfbath"] },
  { key: "totalBaths", label: "Total baths", aliases: ["baths", "bathrooms", "totalbaths", "bathstotal", "totalbathrooms", "ba", "bath"] },
  { key: "sqft", label: "Living SqFt", aliases: ["sqftliving", "livingsqft", "sqft", "squarefeet", "squarefootage", "livingarea", "adjsqft", "adjustedsqft", "totalsqft", "sqfttotal", "approxlivingsqft", "buildingsqft", "livingsqfeet", "sqfeet", "sf", "heatedsqft", "sqftheated"] },
  { key: "lotSqft", label: "Lot SqFt", aliases: ["lotsqft", "lotsizesqft", "lotsize", "lotsquarefeet", "lotsqfeet", "lotsf", "lotsizesquarefeet", "lotarea"] },
  { key: "yearBuilt", label: "Year built", aliases: ["yearbuilt", "yrbuilt", "yearblt", "built", "yb", "yearbuiltactual"] },
  { key: "propertyType", label: "Property type", aliases: ["propertytype", "proptype", "type", "propertysubtype", "propertycategory", "style", "typeofproperty"] },
  { key: "pool", label: "Pool", aliases: ["pool", "poolyn", "privatepool", "haspool", "pool?", "poolprivate"] },
  { key: "waterfront", label: "Waterfront", aliases: ["waterfront", "waterfrontyn", "waterfrontdescription", "haswaterfront", "waterfront?"] },
  { key: "dom", label: "Days on market", aliases: ["dom", "daysonmarket", "adom", "cdom", "daysonmkt", "days"] },
  { key: "listDate", label: "List date", aliases: ["listdate", "listingdate", "listeddate", "datelisted", "listingcontractdate", "onmarketdate", "dateonmarket"] },
  { key: "shortSale", label: "Short sale", aliases: ["shortsale", "shortsaleyn", "isshortsale", "shortsale?", "sstatus", "shortsalesellerapproval"] },
  { key: "reo", label: "REO / bank-owned", aliases: ["reo", "reoyn", "bankowned", "isreo", "bankownedreo", "reobankowned", "foreclosure", "reo?", "bankownedyn"] },
  { key: "remarks", label: "Remarks", aliases: ["remarks", "publicremarks", "internetremarks", "brokerremarks", "brokerinternetremarks", "agentremarks", "listingremarks", "description", "propertydescription", "comments", "marketingremarks", "privateremarks"] },
  { key: "showingInstructions", label: "Showing instructions", aliases: ["showinginstructions", "showinginfo", "showingremarks", "showinginstr", "showing", "showinginstruction"] },
  { key: "agentName", label: "List agent name", aliases: ["listagentname", "listagentfullname", "listingagentname", "listingagent", "listagent", "agentname", "agentfullname", "agent", "listagentfirstlast", "listingagentfullname"] },
  { key: "agentEmail", label: "List agent email", aliases: ["listagentemail", "listingagentemail", "agentemail", "listagentemailaddress", "agentemailaddress", "listagentemailaddr", "email", "listagentpreferredemail"] },
  { key: "agentPhone", label: "List agent phone", aliases: ["listagentphone", "listagentdirectworkphone", "listagentdirectphone", "listagentcellphone", "listagentofficephone", "listingagentphone", "agentphone", "agentcell", "agentdirectphone", "phone", "listagentpreferredphone", "listagentmobilephone"] },
  { key: "officeName", label: "List office name", aliases: ["listofficename", "listingofficename", "listofficeshortname", "officename", "brokerage", "brokeragename", "listbrokerage", "listingbrokerage", "office", "listoffice", "listingoffice"] },
  { key: "officePhone", label: "List office phone", aliases: ["listofficephone", "listingofficephone", "officephone", "brokeragephone", "listofficeprimaryphone"] },
];

export type ColumnMapping = Partial<Record<ImportFieldKey, number | null>>;

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9#?]/g, "");
}

/**
 * Auto-detect mapping: field -> column index. Exact alias match wins; each
 * column is used at most once. Earlier aliases in a field's list have priority.
 */
export function detectMapping(headers: string[]): ColumnMapping {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};

  // Pass 1: process fields in order; for each, scan aliases by priority.
  for (const field of IMPORT_FIELDS) {
    for (const alias of field.aliases) {
      const idx = norm.findIndex((h, i) => h === alias && !used.has(i));
      if (idx >= 0) {
        mapping[field.key] = idx;
        used.add(idx);
        break;
      }
    }
  }

  // Pass 2: a bare "Agent"/"Email"/"Phone" style header is ambiguous, but if
  // "List Agent Email" wasn't found we already accepted bare "email". Nothing more.
  return mapping;
}

export function missingRequired(mapping: ColumnMapping): string[] {
  const missing: string[] = [];
  const has = (k: ImportFieldKey) => mapping[k] != null && mapping[k]! >= 0;
  if (!has("address") && !(has("streetNumber") && has("streetName"))) {
    missing.push("Address (or Street number + Street name)");
  }
  return missing;
}
