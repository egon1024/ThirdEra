const { ArrayField, BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;
import { getEffectiveMaxDex, applyMaxDex, computeAC, computeSpeed } from "./_ac-helpers.mjs";
import { getCarryingCapacity, getLoadStatus, getLoadEffects } from "./_encumbrance-helpers.mjs";
import { getConditionItemsMapSync, getActiveConditionModifiers } from "../logic/condition-helpers.mjs";

/**
 * Data model for D&D 3.5 NPC actors
 * @extends {foundry.abstract.TypeDataModel}
 */
export class NPCData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Ability Scores (base + optional racial adjustment; effective and mod derived)
            abilities: new SchemaField({
                str: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                dex: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                con: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                int: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                wis: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                cha: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    racial: new NumberField({ required: true, integer: true, initial: 0 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // NPC Details (simplified)
            details: new SchemaField({
                type: new StringField({ required: true, blank: true, initial: "" }),
                creatureTypeUuid: new StringField({ required: true, blank: true, initial: "" }),
                subtypeUuids: new ArrayField(new StringField(), { required: true, initial: [] }),
                cr: new StringField({ required: true, blank: true, initial: "1" }),
                alignment: new StringField({ required: true, blank: true, initial: "" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes })
            }),

            // Stat block (monster-only; optional for humanoid NPCs). Phase B–D: natural armor, space, reach, movement, natural attacks. Phase E: DR, SR, senses, special abilities.
            statBlock: new SchemaField({
                naturalArmor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                space: new StringField({ required: true, blank: true, initial: "5 ft" }),
                reach: new StringField({ required: true, blank: true, initial: "5 ft" }),
                movement: new SchemaField({
                    land: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                    fly: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                    flyManeuverability: new StringField({ required: true, blank: true, initial: "", choices: () => CONFIG.THIRDERA?.movementManeuverability ?? {} }),
                    swim: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                    burrow: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                    climb: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
                }),
                naturalAttacks: new ArrayField(
                    new SchemaField({
                        name: new StringField({ required: true, blank: true, initial: "" }),
                        dice: new StringField({ required: true, blank: true, initial: "1d4" }),
                        damageType: new StringField({ required: true, blank: true, initial: "bludgeoning" }),
                        primary: new StringField({ required: true, blank: false, initial: "true", choices: () => ({ "true": "Primary", "false": "Secondary" }) }),
                        reach: new StringField({ required: true, blank: true, initial: "" })
                    }),
                    { required: true, initial: [] }
                ),
                // Phase E: structured special abilities
                damageReduction: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                    bypass: new StringField({ required: true, blank: true, initial: "" })
                }),
                spellResistance: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                senses: new ArrayField(
                    new SchemaField({
                        type: new StringField({ required: true, blank: false, initial: "darkvision", choices: () => CONFIG.THIRDERA?.senseTypes ?? {} }),
                        range: new StringField({ required: true, blank: true, initial: "" })
                    }),
                    { required: true, initial: [] }
                ),
                specialAbilities: new HTMLField({ required: true, blank: true })
            }),

            // Hit Points
            attributes: new SchemaField({
                hp: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: -999, initial: 1 }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
                    stable: new BooleanField({ required: true, initial: false })
                }),
                ac: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    touch: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    flatFooted: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    misc: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                initiative: new SchemaField({
                    bonus: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                speed: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 30 })
                })
            }),

            // Saving Throws
            saves: new SchemaField({
                fort: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                ref: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                will: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // Combat Stats
            combat: new SchemaField({
                bab: new NumberField({ required: true, integer: true, initial: 0 }),
                grapple: new NumberField({ required: true, integer: true, initial: 0 }),
                meleeAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                rangedAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // Biography/Description
            biography: new HTMLField({ required: true, blank: true }),

            // Currency
            currency: new SchemaField({
                pp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Platinum (pp)" }),
                gp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Gold (gp)" }),
                sp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Silver (sp)" }),
                cp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Copper (cp)" })
            })
        };
    }

    /**
     * Prepare derived data for the NPC
     */
    prepareDerivedData() {
        // Calculate effective score (base + racial) and modifier
        for (const [key, ability] of Object.entries(this.abilities)) {
            const racial = ability.racial ?? 0;
            ability.effective = ability.value + racial;
            ability.mod = Math.floor((ability.effective - 10) / 2);
        }

        // Calculate inventory weight and load early so it can affect Dex and Speed
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

        const capacity = getCarryingCapacity(this.abilities.str.value, this.details.size);
        const load = getLoadStatus(totalWeight, capacity);
        const loadEffects = getLoadEffects(load);
        this.loadEffects = loadEffects;

        // Apply armor AND load max-Dex cap to Dex modifier before any derived calculations
        const effectiveMaxDex = getEffectiveMaxDex(this, loadEffects.maxDex);
        applyMaxDex(this, effectiveMaxDex);

        // Calculate initiative
        this.attributes.initiative.bonus = this.abilities.dex.mod;

        // Calculate saves
        this.saves.fort.total = this.saves.fort.base + this.abilities.con.mod;
        this.saves.ref.total = this.saves.ref.base + this.abilities.dex.mod;
        this.saves.will.total = this.saves.will.base + this.abilities.wis.mod;

        // Size modifier for attack rolls and grapple
        const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[this.details.size] ?? 0;
        this.combat.sizeMod = sizeMod;

        // Condition modifiers (Phase 2)
        const conditionMap = getConditionItemsMapSync();
        const conditionMods = getActiveConditionModifiers(this.parent, conditionMap);

        // Apply condition modifiers to saves
        this.saves.fort.total += conditionMods.saves.fort;
        this.saves.ref.total += conditionMods.saves.ref;
        this.saves.will.total += conditionMods.saves.will;
        this.saves.fort.breakdown = [...(this.saves.fort.breakdown || []), ...conditionMods.saveBreakdown.fort];
        this.saves.ref.breakdown = [...(this.saves.ref.breakdown || []), ...conditionMods.saveBreakdown.ref];
        this.saves.will.breakdown = [...(this.saves.will.breakdown || []), ...conditionMods.saveBreakdown.will];

        // Calculate grapple
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

        // Natural attacks (Phase C): primary = full attack bonus + full Str to damage; secondary = -5 attack, half Str to damage
        const naturalAttacks = this.statBlock?.naturalAttacks ?? [];
        const strMod = this.abilities.str.mod;
        const meleeTotal = this.combat.meleeAttack.total;
        for (let i = 0; i < naturalAttacks.length; i++) {
            const atk = naturalAttacks[i];
            const isPrimary = atk.primary === "true";
            atk.attackBonus = meleeTotal + (isPrimary ? 0 : -5);
            atk.attackBreakdown = [
                { label: "Melee", value: meleeTotal },
                ...(isPrimary ? [] : [{ label: "Secondary", value: -5 }])
            ];
            const damageStrMod = isPrimary ? strMod : Math.floor(strMod / 2);
            atk.damageMod = damageStrMod;
            const dice = (atk.dice || "").trim() || "1d4";
            atk.damageFormula = damageStrMod >= 0 ? `${dice} + ${damageStrMod}` : `${dice} − ${Math.abs(damageStrMod)}`;
        }

        // Calculate AC values from equipped armor, dex, size, misc, and conditions
        computeAC(this, conditionMods);

        // Apply armor speed reduction and condition speed multiplier
        this.attributes.speed.info = computeSpeed(this, this.loadEffects, conditionMods.speedMultiplier);

        // Show Stable checkbox when HP is in dying range (−9 to −1)
        const hpVal = Number(this.attributes.hp.value);
        this.attributes.hp.dyingStableVisible = (hpVal >= -9 && hpVal <= -1);

        this.inventory = {
            totalWeight,
            capacity,
            load
        };

        // Movement display (Phase D): build line and segments from statBlock.movement + base land speed
        const mov = this.statBlock?.movement;
        const baseLand = this.attributes.speed?.info?.baseSpeed ?? this.attributes.speed?.value ?? 30;
        const landSpeed = (mov && Number(mov.land) > 0) ? Number(mov.land) : baseLand;
        const maneuverabilityLabels = CONFIG.THIRDERA?.movementManeuverability ?? {};
        const segments = [];
        if (landSpeed > 0) {
            segments.push({ mode: "land", label: "Land", value: landSpeed, maneuverability: null });
        }
        if (mov && Number(mov.fly) > 0) {
            const man = (mov.flyManeuverability && maneuverabilityLabels[mov.flyManeuverability])
                ? maneuverabilityLabels[mov.flyManeuverability]
                : null;
            segments.push({ mode: "fly", label: "Fly", value: Number(mov.fly), maneuverability: man });
        }
        if (mov && Number(mov.swim) > 0) {
            segments.push({ mode: "swim", label: "Swim", value: Number(mov.swim), maneuverability: null });
        }
        if (mov && Number(mov.burrow) > 0) {
            segments.push({ mode: "burrow", label: "Burrow", value: Number(mov.burrow), maneuverability: null });
        }
        if (mov && Number(mov.climb) > 0) {
            segments.push({ mode: "climb", label: "Climb", value: Number(mov.climb), maneuverability: null });
        }
        this.movementDisplaySegments = segments;
        this.movementDisplayLine = segments.length === 0
            ? ""
            : segments
                .map(s => {
                    if (s.mode === "land") return `${s.value} ft`;
                    if (s.maneuverability) return `${s.label.toLowerCase()} ${s.value} ft (${s.maneuverability})`;
                    return `${s.label.toLowerCase()} ${s.value} ft`;
                })
                .join(", ");
    }
}
