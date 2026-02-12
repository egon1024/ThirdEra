const { HTMLField, NumberField, SchemaField, StringField, ArrayField, BooleanField } = foundry.data.fields;
import { getEffectiveMaxDex, applyMaxDex, computeAC, computeSpeed } from "./_ac-helpers.mjs";
import { ClassData } from "./item-class.mjs";

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
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Current HP" }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Maximum HP" }),
                    temp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Temporary HP" }),
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
                hpRolled: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "HP Rolled" })
            })),

            // GM-granted skills (override forbidden status, treat as class skills)
            grantedSkills: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: false, label: "Skill Key" }),
                name: new StringField({ required: true, blank: false, label: "Skill Name" })
            }))
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

        // Apply armor max-Dex cap to Dex modifier before any derived calculations
        const effectiveMaxDex = getEffectiveMaxDex(this);
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
            let armorPenalty = 0;
            if (sd.armorCheckPenalty === "true") {
                armorPenalty = totalArmorCheckPenalty;
            }
            sd.armorPenalty = armorPenalty;

            // Recalculate total with armor penalty
            const abilityMod = this.abilities[sd.ability]?.mod || 0;
            const misc = sd.modifier?.misc || 0;
            sd.modifier.total = abilityMod + ranks + misc + armorPenalty;

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

        // Calculate grapple (BAB + STR mod + size modifier)
        // TODO: Add size modifier calculation
        this.combat.grapple = this.combat.bab + this.abilities.str.mod;

        // Calculate melee and ranged attack bonuses
        this.combat.meleeAttack.total = this.combat.bab + this.abilities.str.mod + sizeMod + this.combat.meleeAttack.misc;
        this.combat.meleeAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "STR", value: this.abilities.str.mod },
            { label: "Size", value: sizeMod }
        ];

        this.combat.rangedAttack.total = this.combat.bab + this.abilities.dex.mod + sizeMod + this.combat.rangedAttack.misc;
        this.combat.rangedAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "DEX", value: this.abilities.dex.mod },
            { label: "Size", value: sizeMod }
        ];

        // Calculate AC values from equipped armor, dex, size, and misc
        computeAC(this);

        // Apply armor speed reduction (medium/heavy armor)
        computeSpeed(this);
    }
}
