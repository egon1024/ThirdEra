const { ArrayField, BooleanField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;
import { getEffectiveMaxDex, applyMaxDex, computeAC, computeSpeed } from "./_ac-helpers.mjs";
import { getCarryingCapacity, getLoadStatus, getLoadEffects } from "./_encumbrance-helpers.mjs";
import { ClassData } from "./item-class.mjs";
import { getSpellsForDomain } from "../logic/domain-spells.mjs";
import { getConditionItemsMapSync, getActiveConditionModifiers } from "../logic/condition-helpers.mjs";

/**
 * Data model for D&D 3.5 Character actors
 * @extends {foundry.abstract.TypeDataModel}
 */
export class CharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Ability Scores
            abilities: new SchemaField({
                str: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Strength" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                dex: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Dexterity" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                con: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Constitution" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                int: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Intelligence" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                wis: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Wisdom" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                cha: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Charisma" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                })
            }),

            // Character Details
            details: new SchemaField({
                class: new StringField({ required: true, blank: true, initial: "", label: "Class" }),
                level: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Level" }),
                alignment: new StringField({ required: true, blank: true, initial: "", label: "Alignment" }),
                deity: new StringField({ required: true, blank: true, initial: "", label: "Deity" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
                age: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Age" }),
                gender: new StringField({ required: true, blank: true, initial: "", label: "Gender" }),
                height: new StringField({ required: true, blank: true, initial: "", label: "Height" }),
                weight: new StringField({ required: true, blank: true, initial: "", label: "Weight" })
            }),

            // Hit Points
            attributes: new SchemaField({
                hp: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: -999, initial: 1, label: "Current HP" }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Maximum HP" }),
                    temp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Temporary HP" }),
                    stable: new BooleanField({ required: true, initial: false, label: "Stabilized (when dying)" }),
                    adjustments: new ArrayField(new SchemaField({
                        value: new NumberField({ required: true, integer: true, initial: 0, label: "Adjustment" }),
                        label: new StringField({ required: true, blank: false, initial: "Misc", label: "Reason" })
                    }))
                }),
                ac: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Armor Class" }),
                    touch: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Touch AC" }),
                    flatFooted: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Flat-Footed AC" }),
                    misc: new NumberField({ required: true, integer: true, initial: 0, label: "Misc AC Bonus" })
                }),
                initiative: new SchemaField({
                    bonus: new NumberField({ required: true, integer: true, initial: 0, label: "Initiative Bonus" })
                }),
                speed: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Speed (ft)" })
                })
            }),

            // Saving Throws
            saves: new SchemaField({
                fort: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                }),
                ref: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                }),
                will: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                })
            }),

            // Base Attack Bonus
            combat: new SchemaField({
                bab: new NumberField({ required: true, integer: true, initial: 0, label: "Base Attack Bonus" }),
                grapple: new NumberField({ required: true, integer: true, initial: 0, label: "Grapple" }),
                meleeAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0, label: "Melee Misc Bonus" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Melee Attack Bonus" })
                }),
                rangedAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0, label: "Ranged Misc Bonus" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Ranged Attack Bonus" })
                })
            }),

            // Biography
            biography: new HTMLField({ required: true, blank: true, label: "Biography" }),

            // Experience Points
            experience: new SchemaField({
                value: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Current XP" }),
                max: new NumberField({ required: true, integer: true, min: 0, initial: 1000, label: "XP for Next Level" })
            }),

            // Class level advancement history (ordered by character level)
            levelHistory: new ArrayField(new SchemaField({
                classItemId: new StringField({ required: true, blank: false, label: "Class Item ID" }),
                hpRolled: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "HP Rolled" }),
                featItemId: new StringField({ required: false, blank: true, initial: "", label: "Feat Item ID (gained at this level)" }),
                featName: new StringField({ required: false, blank: true, initial: "", label: "Feat Name (display fallback)" }),
                featKey: new StringField({ required: false, blank: true, initial: "", label: "Feat Key" }),
                /** Embedded feat item IDs that were auto-granted at this level (for level-down and class removal cleanup). */
                autoGrantedFeatIds: new ArrayField(new StringField({ required: false, blank: true }), { required: false, initial: [], label: "Auto-Granted Feat IDs" }),
                skillsGained: new ArrayField(new SchemaField({
                    key: new StringField({ required: true, blank: false, label: "Skill Key" }),
                    ranks: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Ranks Added" })
                }), { required: false, initial: [], label: "Skills Gained at This Level" })
            })),

            // GM-granted skills (override forbidden status, treat as class skills)
            grantedSkills: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: false, label: "Skill Key" }),
                name: new StringField({ required: true, blank: false, label: "Skill Name" })
            })),

            // Currency
            currency: new SchemaField({
                pp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Platinum (pp)" }),
                gp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Gold (gp)" }),
                sp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Silver (sp)" }),
                cp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Copper (cp)" })
            }),

            // Spell shortlist for full-list prepared casters (cleric, druid): classItemId -> spell item IDs to show in "Ready to cast"
            spellShortlistByClass: new ObjectField({ initial: {}, label: "Spell Shortlist by Class" })
        };
    }

    /**
     * Prepare derived data for the character
     */
    prepareDerivedData() {
        // Apply racial ability adjustments and calculate modifiers
        const race = this.parent.items.find(i => i.type === "race");
        for (const [key, ability] of Object.entries(this.abilities)) {
            ability.racial = race?.system.abilityAdjustments[key] ?? 0;
            ability.effective = ability.value + ability.racial;
            ability.mod = Math.floor((ability.effective - 10) / 2);
        }

        // Calculate inventory weight and load early so it can affect Dex, Speed, and Skills
        let totalWeight = 0;
        const itemsInContainers = new Set();
        
        // First pass: calculate weight of items not in containers, and track container contents
        for (const item of this.parent.items) {
            const containerId = item.system.containerId;
            if (containerId) {
                itemsInContainers.add(item.id);
            } else {
                // Item not in a container - add its weight
                const weight = item.system.weight || 0;
                const quantity = item.system.quantity || 1;
                totalWeight += weight * quantity;
            }
        }
        
        // Second pass: handle containers and their contents
        for (const item of this.parent.items) {
            if (item.type !== "equipment" || !item.system.isContainer) continue;
            
            const containerWeight = (item.system.weight || 0) * (item.system.quantity || 1);
            const weightMode = item.system.weightMode || "full";
            
            // Container's own weight always counts
            totalWeight += containerWeight;
            
            // Calculate contents weight based on weight mode
            if (weightMode === "full") {
                // Full weight: add all contents
                for (const contentItem of this.parent.items) {
                    if (contentItem.system.containerId === item.id) {
                        const weight = contentItem.system.weight || 0;
                        const quantity = contentItem.system.quantity || 1;
                        totalWeight += weight * quantity;
                    }
                }
            } else if (weightMode === "fixed") {
                // Fixed weight: contents don't add to weight (magical containers like Bag of Holding)
                // Only container's own weight counts, which we already added
            } else if (weightMode === "reduced") {
                // Reduced weight: future-proofing, for now treat as full
                for (const contentItem of this.parent.items) {
                    if (contentItem.system.containerId === item.id) {
                        const weight = contentItem.system.weight || 0;
                        const quantity = contentItem.system.quantity || 1;
                        totalWeight += weight * quantity;
                    }
                }
            }
        }

        // Add currency weight if setting enabled
        const trackCoinWeight = game.settings.get("thirdera", "currencyWeight");
        if (trackCoinWeight) {
            const c = this.currency;
            const totalCoins = (c.pp || 0) + (c.gp || 0) + (c.sp || 0) + (c.cp || 0);
            if (totalCoins > 0) {
                totalWeight += Math.floor(totalCoins / 50);
            }
        }

        const capacity = getCarryingCapacity(this.abilities.str.effective, this.details.size);
        const load = getLoadStatus(totalWeight, capacity);
        const loadEffects = getLoadEffects(load);
        this.loadEffects = loadEffects; // Store for Speed and Skills calculation later

        // Apply armor AND load max-Dex cap to Dex modifier before any derived calculations
        const effectiveMaxDex = getEffectiveMaxDex(this, loadEffects.maxDex);
        applyMaxDex(this, effectiveMaxDex);

        // Derive class level counts from levelHistory
        const classLevelCounts = {};
        for (const entry of this.levelHistory) {
            classLevelCounts[entry.classItemId] = (classLevelCounts[entry.classItemId] || 0) + 1;
        }
        this.details.classLevels = classLevelCounts;

        // Calculate class-derived values (BAB, base saves, total level)
        const classes = this.parent.items.filter(i => i.type === "class");
        const totalLevel = this.levelHistory.length;
        if (totalLevel > 0) {
            let totalBAB = 0;
            const babBreakdown = [];
            const saveBreakdown = { fort: [], ref: [], will: [] };
            const saveTotals = { fort: 0, ref: 0, will: 0 };

            for (const cls of classes) {
                const lvl = classLevelCounts[cls.id] || 0;
                if (lvl <= 0) continue;

                const classBab = ClassData.computeBAB(lvl, cls.system.babProgression);
                totalBAB += classBab;
                babBreakdown.push({ label: cls.name, value: classBab });

                for (const save of ["fort", "ref", "will"]) {
                    const baseSave = ClassData.computeBaseSave(lvl, cls.system.saves[save]);
                    saveTotals[save] += baseSave;
                    saveBreakdown[save].push({ label: cls.name, value: baseSave });
                }
            }

            this.combat.bab = totalBAB;
            this.combat.babBreakdown = babBreakdown;
            this.details.totalLevel = totalLevel;

            for (const save of ["fort", "ref", "will"]) {
                this.saves[save].base = saveTotals[save];
                this.saves[save].breakdown = saveBreakdown[save];
            }
            // Derive HP max from levelHistory
            const classMap = new Map(classes.map(c => [c.id, c]));
            let hpTotal = 0;
            const hpBreakdown = [];
            for (let i = 0; i < this.levelHistory.length; i++) {
                const entry = this.levelHistory[i];
                const cls = classMap.get(entry.classItemId);
                const className = cls?.name ?? "Unknown";
                const hpFromDie = entry.hpRolled || 0;
                const hpFromCon = this.abilities.con.mod;
                const levelHp = Math.max(1, hpFromDie + hpFromCon);
                hpTotal += levelHp;
                hpBreakdown.push({
                    characterLevel: i + 1,
                    className,
                    hpRolled: hpFromDie,
                    conMod: hpFromCon,
                    subtotal: levelHp
                });
            }
            this.attributes.hp.max = Math.max(1, hpTotal);
            this.attributes.hp.hpBreakdown = hpBreakdown;
        } else {
            this.details.totalLevel = this.details.level;
            this.combat.babBreakdown = [];
            this.attributes.hp.hpBreakdown = [];
            for (const save of ["fort", "ref", "will"]) {
                this.saves[save].breakdown = [];
            }
        }

        // Derive class skill keys — union of all class items' classSkills arrays
        const classSkillKeys = new Set();
        for (const cls of classes) {
            const lvl = classLevelCounts[cls.id] || 0;
            if (lvl <= 0) continue;
            for (const entry of (cls.system.classSkills || [])) {
                classSkillKeys.add(entry.key);
            }
        }
        this.classSkillKeys = classSkillKeys;

        // ---- Class Feature Aggregation ----
        // Walk each class's features array and collect granted features
        const grantedFeatMap = new Map(); // featKey -> aggregated feature object
        const grantedFeaturesByClass = new Map(); // classItemId -> array of features

        for (const cls of classes) {
            const lvl = classLevelCounts[cls.id] || 0;
            if (lvl <= 0) continue;
            const classFeatures = [];

            for (const feature of (cls.system.features || [])) {
                if (feature.level > lvl) continue;

                // Try to resolve scaling value and type from sidebar feat item
                let scalingValue = null;
                let featureType = "feature"; // Default to feature
                try {
                    const sidebarFeat = game.items.get(feature.featItemId);
                    if (sidebarFeat) {
                        featureType = sidebarFeat.type;
                        if (sidebarFeat.system?.scalingTable?.length) {
                            // Find the last entry where minLevel <= classLevel
                            const table = sidebarFeat.system.scalingTable;
                            for (let i = table.length - 1; i >= 0; i--) {
                                if (table[i].minLevel <= lvl) {
                                    scalingValue = table[i].value;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Sidebar item may not exist (deleted); scaling stays null
                }

                const featureEntry = {
                    featKey: feature.featKey,
                    featName: feature.featName,
                    featItemId: feature.featItemId,
                    grantLevel: feature.level,
                    scalingValue,
                    className: cls.name,
                    classItemId: cls.id,
                    classLevel: lvl,
                    type: featureType
                };
                classFeatures.push(featureEntry);

                // Aggregate for deduplication on Feats subtab
                if (grantedFeatMap.has(feature.featKey)) {
                    const existing = grantedFeatMap.get(feature.featKey);
                    existing.sources.push({ className: cls.name, grantLevel: feature.level });
                    existing.isDuplicate = true;
                    // Use the highest class-level scaling value
                    if (scalingValue !== null) existing.scalingValue = scalingValue;
                } else {
                    grantedFeatMap.set(feature.featKey, {
                        featKey: feature.featKey,
                        featName: feature.featName,
                        featItemId: feature.featItemId,
                        scalingValue,
                        sources: [{ className: cls.name, grantLevel: feature.level }],
                        isDuplicate: false,
                        type: featureType
                    });
                }
            }

            if (classFeatures.length) {
                grantedFeaturesByClass.set(cls.id, classFeatures);
            }
        }

        this.grantedFeatures = Array.from(grantedFeatMap.values());
        this.grantedFeaturesByClass = grantedFeaturesByClass;
        this.grantedFeatKeys = new Set(grantedFeatMap.keys());

        // Build excluded skill keys from race
        const excludedSkillKeys = new Set();
        if (race) {
            for (const entry of (race.system.excludedSkills || [])) {
                excludedSkillKeys.add(entry.key);
            }
        }
        this.excludedSkillKeys = excludedSkillKeys;

        // Build GM-granted skill keys (override forbidden, treated as class skills)
        const grantedSkillKeys = new Set();
        for (const entry of (this.grantedSkills || [])) {
            grantedSkillKeys.add(entry.key);
        }
        this.grantedSkillKeys = grantedSkillKeys;

        // Calculate skill point budget
        const skillClassMap = new Map(classes.map(c => [c.id, c]));
        let skillPointsAvailable = 0;
        for (let i = 0; i < this.levelHistory.length; i++) {
            const entry = this.levelHistory[i];
            const cls = skillClassMap.get(entry.classItemId);
            const basePoints = cls?.system.skillPointsPerLevel ?? 0;
            const intMod = this.abilities.int.mod;
            let points = Math.max(1, basePoints + intMod);
            // First character level gets 4x skill points
            if (i === 0) points *= 4;
            skillPointsAvailable += points;
        }

        // Annotate skill items with class skill status, max ranks, and armor penalty
        // This runs in the actor's prepareDerivedData (after items are prepared),
        // so classSkillKeys is available here.
        const skillItems = this.parent.items.filter(i => i.type === "skill");
        let skillPointsSpent = 0;

        // Compute total armor check penalty once (sum of all equipped armor/shields)
        let totalArmorCheckPenalty = 0;
        for (const item of this.parent.items) {
            if (item.type !== "armor") continue;
            if (item.system.equipped !== "true") continue;
            totalArmorCheckPenalty += (item.system.armor?.checkPenalty || 0);
        }

        for (const skill of skillItems) {
            const sd = skill.system;
            const ranks = sd.ranks || 0;
            const isGranted = !!(sd.key && grantedSkillKeys.has(sd.key));
            const isClassSkill = isGranted || !!(sd.key && classSkillKeys.has(sd.key));
            const maxRanks = isClassSkill ? totalLevel + 3 : (totalLevel + 3) / 2;

            // Determine forbidden status (GM-granted skills override all restrictions)
            let isForbidden = false;
            let forbiddenReason = "";
            if (!isGranted) {
                if (sd.key && excludedSkillKeys.has(sd.key)) {
                    isForbidden = true;
                    forbiddenReason = "Excluded by race";
                } else if (sd.exclusive === "true" && sd.key && !classSkillKeys.has(sd.key)) {
                    isForbidden = true;
                    forbiddenReason = "Exclusive — requires a class that grants this skill";
                }
            }

            sd.isGranted = isGranted;
            sd.isClassSkill = isClassSkill;
            sd.maxRanks = maxRanks;
            sd.isForbidden = isForbidden;
            sd.forbiddenReason = forbiddenReason;

            // Apply armor check penalty to skills flagged for it
            // SRD: "If you are wearing armor and carrying a load, use the worse of the two check penalties"
            let acpPenalty = 0;
            if (sd.armorCheckPenalty === "true") {
                acpPenalty = Math.min(totalArmorCheckPenalty, loadEffects.acp);
            }
            sd.armorPenalty = acpPenalty;

            // Recalculate total with armor/load penalty
            const abilityMod = this.abilities[sd.ability]?.mod || 0;
            const misc = sd.modifier?.misc || 0;
            sd.modifier.total = abilityMod + ranks + misc + acpPenalty;

            // Build skill breakdown for tooltips
            sd.breakdown = [
                { label: "Ability", value: abilityMod },
                { label: "Ranks", value: ranks }
            ];
            if (misc !== 0) sd.breakdown.push({ label: "Misc", value: misc });
            if (acpPenalty !== 0) {
                let label = "Armor ACP";
                if (loadEffects.acp < totalArmorCheckPenalty) {
                    label = "Load ACP";
                } else if (loadEffects.acp === totalArmorCheckPenalty && totalArmorCheckPenalty !== 0) {
                    label = "Armor & Load ACP";
                } else if (totalArmorCheckPenalty === 0 && loadEffects.acp !== 0) {
                    label = "Load ACP";
                }
                sd.breakdown.push({ label, value: acpPenalty });
            }
            sd.modifier.breakdown_formatted = sd.breakdown.map(b => `${b.label}: ${b.value >= 0 ? "+" : ""}${b.value}`).join("\n");

            // Cross-class skills cost 2 points per rank, class skills cost 1
            // Forbidden skills don't count toward spent (shouldn't have ranks)
            if (!isForbidden) {
                skillPointsSpent += isClassSkill ? ranks : ranks * 2;
            }
        }

        this.skillPointBudget = {
            available: skillPointsAvailable,
            spent: skillPointsSpent,
            remaining: skillPointsAvailable - skillPointsSpent
        };

        // ---- Spellcasting Calculations ----
        // Calculate caster level, spells per day, and spell DC for each class
        const spellcastingByClass = [];
        for (const cls of classes) {
            const lvl = classLevelCounts[cls.id] || 0;
            if (lvl <= 0) continue;

            const sc = cls.system.spellcasting;
            if (!sc || !sc.enabled || sc.casterType === "none") continue;

            // Caster level is the class level for that class
            const casterLevel = lvl;

            // Get casting ability modifier
            const castingAbility = sc.castingAbility || "none";
            const abilityMod = castingAbility !== "none" ? (this.abilities[castingAbility]?.mod || 0) : 0;

            // Calculate spell DC: 10 + spell level + ability modifier
            // We'll calculate this per spell level when displaying
            const baseSpellDC = 10 + abilityMod;

            // Get spells per day from the table
            const spellsPerDay = {};
            const table = sc.spellsPerDayTable || [];
            for (let spellLevel = 0; spellLevel <= 9; spellLevel++) {
                spellsPerDay[spellLevel] = ClassData.getSpellsPerDay(table, lvl, spellLevel);
            }

            // Resolve domain items and calculate domain spell slots (only when this class supports domains, e.g. Cleric)
            const supportsDomains = sc.supportsDomains === "true";
            const domains = [];
            const domainSpellSlots = {};
            const domainSpellsByLevel = {};

            for (let spellLevel = 0; spellLevel <= 9; spellLevel++) {
                domainSpellSlots[spellLevel] = 0;
                domainSpellsByLevel[spellLevel] = [];
            }

            if (supportsDomains && sc.domains && sc.domains.length > 0) {
                for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
                    if (spellsPerDay[spellLevel] > 0) {
                        domainSpellSlots[spellLevel] = 1;
                    }
                }

                for (const domainRef of sc.domains) {
                    const domainKey = (domainRef.domainKey || "").trim();
                    const domainName = (domainRef.domainName || "").trim() || domainKey;
                    if (!domainKey) continue;
                    try {
                        domains.push({
                            domainItemId: domainRef.domainItemId || "",
                            domainName,
                            domainKey
                        });

                        const granted = getSpellsForDomain(domainKey);
                        for (const entry of granted) {
                            const sl = entry.level;
                            if (sl >= 1 && sl <= 9 && entry.spellName) {
                                domainSpellsByLevel[sl].push({
                                    domainName,
                                    domainKey,
                                    spellName: entry.spellName
                                });
                            }
                        }
                    } catch (e) {
                        console.warn(`Domain ${domainName || domainRef.domainItemId} failed for class ${cls.name}:`, e);
                    }
                }
                // Ensure at least 1 domain slot per level that has domain spells (in case spellsPerDay table omits or is 0)
                for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
                    if ((domainSpellsByLevel[spellLevel] || []).length > 0) {
                        domainSpellSlots[spellLevel] = Math.max(domainSpellSlots[spellLevel] || 0, 1);
                    }
                }
            }

            // Resolve spell list key: use explicit value, or derive from class name for backwards compatibility
            let spellListKey = sc.spellListKey?.trim() || "";
            if (!spellListKey && cls.name) {
                const name = cls.name.toLowerCase();
                if (name === "wizard" || name === "sorcerer") spellListKey = "sorcererWizard";
                else spellListKey = name;
            }

            spellcastingByClass.push({
                classItemId: cls.id,
                className: cls.name,
                spellListKey,
                casterLevel,
                casterType: sc.casterType,
                preparationType: sc.preparationType,
                spellListAccess: sc.spellListAccess || "none",
                supportsDomains,
                castingAbility,
                abilityMod,
                baseSpellDC,
                spellsPerDay,
                domains,
                domainSpellSlots,
                domainSpellsByLevel,
                hasSpellcasting: true
            });
        }

        this.spellcastingByClass = spellcastingByClass;

        // Apply HP adjustments (feats, curses, magic items, etc.)
        const hpAdjTotal = this.attributes.hp.adjustments.reduce((sum, adj) => sum + adj.value, 0);
        this.attributes.hp.max = Math.max(1, this.attributes.hp.max + hpAdjTotal);

        // Calculate initiative
        this.attributes.initiative.bonus = this.abilities.dex.mod;

        // Calculate saves (base + ability modifier)
        this.saves.fort.total = this.saves.fort.base + this.abilities.con.mod;
        this.saves.ref.total = this.saves.ref.base + this.abilities.dex.mod;
        this.saves.will.total = this.saves.will.base + this.abilities.wis.mod;

        // Size modifier for attack rolls and grapple
        const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[this.details.size] ?? 0;
        this.combat.sizeMod = sizeMod;

        // Condition modifiers (Phase 2): aggregate from active effects
        const conditionMap = getConditionItemsMapSync();
        const conditionMods = getActiveConditionModifiers(this.parent, conditionMap);

        // Apply condition modifiers to saves (total + breakdown)
        this.saves.fort.total += conditionMods.saves.fort;
        this.saves.ref.total += conditionMods.saves.ref;
        this.saves.will.total += conditionMods.saves.will;
        for (const save of ["fort", "ref", "will"]) {
            if (conditionMods.saveBreakdown[save].length) {
                this.saves[save].breakdown = [...(this.saves[save].breakdown || []), ...conditionMods.saveBreakdown[save]];
            }
        }

        // Calculate grapple (BAB + STR mod + size modifier)
        // TODO: Add size modifier calculation
        this.combat.grapple = this.combat.bab + this.abilities.str.mod;

        // Calculate melee and ranged attack bonuses (include condition modifiers)
        this.combat.meleeAttack.total = this.combat.bab + this.abilities.str.mod + sizeMod + this.combat.meleeAttack.misc + conditionMods.attackMelee;
        this.combat.meleeAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "STR", value: this.abilities.str.mod },
            { label: "Size", value: sizeMod },
            ...(conditionMods.attackMeleeBreakdown || [])
        ];

        this.combat.rangedAttack.total = this.combat.bab + this.abilities.dex.mod + sizeMod + this.combat.rangedAttack.misc + conditionMods.attackRanged;
        this.combat.rangedAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "DEX", value: this.abilities.dex.mod },
            { label: "Size", value: sizeMod },
            ...(conditionMods.attackRangedBreakdown || [])
        ];

        // Calculate AC values from equipped armor, dex, size, misc, and conditions
        computeAC(this, conditionMods);

        // Apply armor speed reduction and condition speed multiplier (e.g. half speed)
        this.attributes.speed.info = computeSpeed(this, this.loadEffects, conditionMods.speedMultiplier);

        // Show Stable checkbox when HP is in dying range (−9 to −1)
        const hpVal = Number(this.attributes.hp.value);
        this.attributes.hp.dyingStableVisible = (hpVal >= -9 && hpVal <= -1);

        this.inventory = {
            totalWeight,
            capacity,
            load
        };
    }
}
