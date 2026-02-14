/**
 * Compendium Loader
 * Loads JSON files from packs/ directories into Foundry compendiums
 */

export class CompendiumLoader {
    /**
     * File mappings for each compendium pack
     */
    static FILE_MAPPINGS = {
        "thirdera.thirdera_races": [
            "race-dwarf.json", "race-elf.json", "race-gnome.json",
            "race-half-elf.json", "race-half-orc.json", "race-halfling.json", "race-human.json"
        ],
        "thirdera.thirdera_classes": [
            "class-barbarian.json", "class-bard.json", "class-cleric.json",
            "class-druid.json", "class-fighter.json", "class-monk.json",
            "class-paladin.json", "class-ranger.json", "class-rogue.json",
            "class-sorcerer.json", "class-wizard.json"
        ],
        "thirdera.thirdera_skills": [
            "skill-appraise.json", "skill-balance.json", "skill-bluff.json",
            "skill-climb.json", "skill-concentration.json", "skill-craft.json",
            "skill-decipher-script.json", "skill-diplomacy.json", "skill-disable-device.json",
            "skill-disguise.json", "skill-escape-artist.json", "skill-forgery.json",
            "skill-gather-information.json", "skill-handle-animal.json", "skill-heal.json",
            "skill-hide.json", "skill-intimidate.json", "skill-jump.json",
            "skill-knowledge.json", "skill-listen.json", "skill-move-silently.json",
            "skill-open-lock.json", "skill-perform.json", "skill-profession.json",
            "skill-ride.json", "skill-search.json", "skill-sense-motive.json",
            "skill-sleight-of-hand.json", "skill-speak-language.json", "skill-spellcraft.json",
            "skill-spot.json", "skill-survival.json", "skill-swim.json",
            "skill-tumble.json", "skill-use-magic-device.json", "skill-use-rope.json"
        ],
        "thirdera.thirdera_feats": [
            "feat-alertness.json", "feat-animal-affinity.json", "feat-athletic.json",
            "feat-blind-fight.json", "feat-brew-potion.json", "feat-cleave.json",
            "feat-combat-expertise.json", "feat-combat-reflexes.json", "feat-craft-magic-arms-and-armor.json",
            "feat-craft-rod.json", "feat-craft-staff.json", "feat-craft-wand.json",
            "feat-craft-wondrous-item.json", "feat-deceitful.json", "feat-deft-hands.json",
            "feat-diligent.json", "feat-dodge.json", "feat-empower-spell.json",
            "feat-endurance.json", "feat-enlarge-spell.json", "feat-eschew-materials.json",
            "feat-exotic-weapon-proficiency.json", "feat-extend-spell.json", "feat-extra-turning.json",
            "feat-forge-ring.json", "feat-great-cleave.json", "feat-great-fortitude.json",
            "feat-heighten-spell.json", "feat-improved-bull-rush.json", "feat-improved-counterspell.json",
            "feat-improved-critical.json", "feat-improved-disarm.json", "feat-improved-feint.json",
            "feat-improved-grapple.json", "feat-improved-initiative.json", "feat-improved-overrun.json",
            "feat-improved-sunder.json", "feat-improved-trip.json", "feat-improved-two-weapon-fighting.json",
            "feat-improved-unarmed-strike.json", "feat-investigator.json", "feat-iron-will.json",
            "feat-leadership.json", "feat-lightning-reflexes.json", "feat-magical-aptitude.json",
            "feat-martial-weapon-proficiency.json", "feat-maximize-spell.json", "feat-mobility.json",
            "feat-mounted-archery.json", "feat-mounted-combat.json", "feat-negotiator.json",
            "feat-nimble-fingers.json", "feat-persuasive.json", "feat-point-blank-shot.json",
            "feat-power-attack.json", "feat-precise-shot.json", "feat-quick-draw.json",
            "feat-quicken-spell.json", "feat-rapid-reload.json", "feat-rapid-shot.json",
            "feat-ride-by-attack.json", "feat-run.json", "feat-scribe-scroll.json",
            "feat-self-sufficient.json", "feat-shield-bash.json", "feat-shield-proficiency.json",
            "feat-shot-on-the-run.json", "feat-silent-spell.json", "feat-simple-weapon-proficiency.json",
            "feat-skill-focus.json", "feat-spell-focus.json", "feat-spell-mastery.json",
            "feat-spirited-charge.json", "feat-spring-attack.json", "feat-stealthy.json",
            "feat-still-spell.json", "feat-toughness.json", "feat-track.json",
            "feat-trample.json", "feat-two-weapon-defense.json", "feat-two-weapon-fighting.json",
            "feat-weapon-finesse.json", "feat-weapon-focus.json", "feat-weapon-specialization.json",
            "feat-whirlwind-attack.json", "feat-widen-spell.json"
        ],
        "thirdera.thirdera_weapons": [
            "weapon-bastard-sword.json", "weapon-battleaxe.json", "weapon-bolas.json",
            "weapon-club.json", "weapon-composite-longbow.json", "weapon-composite-shortbow.json",
            "weapon-dagger.json", "weapon-dart.json", "weapon-dire-flail.json",
            "weapon-dwarven-urgrosh.json", "weapon-dwarven-waraxe.json", "weapon-flail.json",
            "weapon-gauntlet.json", "weapon-glaive.json", "weapon-gnome-hooked-hammer.json",
            "weapon-greataxe.json", "weapon-greatclub.json", "weapon-greatsword.json",
            "weapon-guisarme.json", "weapon-halberd.json", "weapon-handaxe.json",
            "weapon-hand-crossbow.json", "weapon-heavy-crossbow.json", "weapon-heavy-mace.json",
            "weapon-javelin.json", "weapon-kama.json", "weapon-kukri.json",
            "weapon-lance.json", "weapon-light-crossbow.json", "weapon-light-mace.json",
            "weapon-longbow.json", "weapon-longspear.json", "weapon-longsword.json",
            "weapon-mace.json", "weapon-morningstar.json", "weapon-net.json",
            "weapon-nunchaku.json", "weapon-orc-double-axe.json", "weapon-pike.json",
            "weapon-quarterstaff.json", "weapon-ranseur.json", "weapon-rapier.json",
            "weapon-repeating-heavy-crossbow.json", "weapon-repeating-light-crossbow.json",
            "weapon-sai.json", "weapon-scimitar.json", "weapon-scythe.json",
            "weapon-shortbow.json", "weapon-shortspear.json", "weapon-shortsword.json",
            "weapon-shuriken.json", "weapon-siamese-sword.json", "weapon-sickle.json",
            "weapon-sling.json", "weapon-spear.json", "weapon-spiked-chain.json",
            "weapon-trident.json", "weapon-two-bladed-sword.json", "weapon-unarmed-strike.json",
            "weapon-warhammer.json", "weapon-whip.json"
        ],
        "thirdera.thirdera_armor": [
            "armor-padded.json", "armor-leather.json", "armor-studded-leather.json",
            "armor-hide.json", "armor-chain-shirt.json", "armor-scale-mail.json",
            "armor-chainmail.json", "armor-breastplate.json", "armor-splint-mail.json",
            "armor-bandmail.json", "armor-half-plate.json", "armor-full-plate.json",
            "shield-buckler.json", "shield-light.json", "shield-heavy.json", "shield-tower.json"
        ],
        "thirdera.thirdera_equipment": [
            "equipment-alchemists-fire.json", "equipment-anti-toxin.json", "equipment-arcane-mark.json",
            "equipment-backpack.json", "equipment-bag-hempen.json", "equipment-barrel.json",
            "equipment-basket.json", "equipment-bedroll.json", "equipment-bucket.json",
            "equipment-caltrops.json", "equipment-case-for-wand-or-scroll.json", "equipment-case-map-or-scroll.json",
            "equipment-chalk.json", "equipment-chest.json", "equipment-common-clothes.json",
            "equipment-courtiers-outfit.json", "equipment-crowbar.json", "equipment-entertainers-outfit.json",
            "equipment-explorers-outfit.json", "equipment-flint-and-steel.json", "equipment-grappling-hook.json",
            "equipment-hammer.json", "equipment-hemp-rope.json", "equipment-holy-symbol.json",
            "equipment-holy-symbol-silver.json", "equipment-holy-water.json", "equipment-ink.json",
            "equipment-inkpen.json", "equipment-iron-spikes.json", "equipment-lantern-bullseye.json",
            "equipment-lantern-hooded.json", "equipment-lock.json", "equipment-magnifying-glass.json",
            "equipment-manacles.json", "equipment-manacles-masterwork.json", "equipment-mirror-small.json",
            "equipment-monks-outfit.json", "equipment-nobles-outfit.json", "equipment-oil.json",
            "equipment-paper.json", "equipment-parchment.json", "equipment-peasants-outfit.json",
            "equipment-pitons.json", "equipment-pouch.json", "equipment-rations.json",
            "equipment-robe.json", "equipment-royal-outfit.json", "equipment-sack.json",
            "equipment-scholars-outfit.json", "equipment-sealing-wax.json", "equipment-signet-ring.json",
            "equipment-silk-rope.json", "equipment-spell-component-pouch.json", "equipment-sunrod.json",
            "equipment-tanglefoot-bag.json", "equipment-tent.json", "equipment-thunderstone.json",
            "equipment-tindertwig.json", "equipment-torch.json", "equipment-trail-rations.json",
            "equipment-travelers-outfit.json", "equipment-vial.json", "equipment-waterskin.json"
        ],
        "thirdera.thirdera_spells": [
            "spell-magic-missile.json", "spell-cure-light-wounds.json", "spell-fireball.json",
            "spell-lightning-bolt.json", "spell-cure-moderate-wounds.json", "spell-shield.json",
            "spell-mage-armor.json", "spell-detect-magic.json", "spell-bless.json",
            "spell-heal.json"
        ]
    };

    /**
     * Initialize compendiums by loading JSON files
     */
    static async init() {
        // Only run if we're the GM
        if (!game.user.isGM) return;

        // Wait a bit for compendiums to be fully registered
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Debug: log all available packs
        console.log("Third Era | Available packs:", Array.from(game.packs.keys()));

        for (const [packName, fileList] of Object.entries(CompendiumLoader.FILE_MAPPINGS)) {
            // Try multiple ways to find the pack
            let pack = game.packs.get(packName);
            
            if (!pack) {
                // Try finding by collection or metadata name
                pack = game.packs.find(p => 
                    p.collection === packName || 
                    p.metadata?.name === packName ||
                    p.metadata?.label === packName.replace("thirdera.", "").replace(/^./, str => str.toUpperCase())
                );
            }
            if (!pack) {
                console.warn(`Third Era | Compendium ${packName} not found. Available packs:`, Array.from(game.packs.keys()));
                // Log pack details for debugging
                game.packs.forEach(p => {
                    console.log(`Third Era | Pack: ${p.collection}, name: ${p.metadata?.name}, label: ${p.metadata?.label}`);
                });
                continue;
            }

            // Load JSON files (will update existing items or create new ones)
            try {
                await CompendiumLoader.loadPackFromJSON(pack, fileList);
            } catch (error) {
                console.error(`Third Era | Error loading compendium ${packName}:`, error);
            }
        }
    }

    /**
     * Load a compendium pack from JSON files
     * @param {CompendiumCollection} pack - The compendium pack to populate
     * @param {string[]} fileList - List of JSON file names to load
     */
    static async loadPackFromJSON(pack, fileList) {
        // Normalize the path - remove any existing systems/thirdera/ prefix to avoid duplication
        let normalizedPath = pack.metadata.path;
        if (normalizedPath.startsWith('systems/thirdera/')) {
            normalizedPath = normalizedPath.replace(/^systems\/thirdera\//, '');
        } else if (normalizedPath.startsWith('systems/')) {
            // Different system path, keep as-is but log warning
            console.warn(`Third Era | Unexpected path format: ${normalizedPath}`);
        }
        // Always construct the full path from the normalized relative path
        const basePath = `systems/thirdera/${normalizedPath}`;
        
        const documents = [];

        for (const fileName of fileList) {
            const filePath = `${basePath}/${fileName}`;
            
            try {
                const response = await fetch(`/${filePath}`);
                if (!response.ok) {
                    console.warn(`Third Era | Could not load ${filePath} (status: ${response.status})`);
                    continue;
                }
                const jsonData = await response.json();
                
                // Remove invalid _id - Foundry will generate a valid one
                // Foundry requires 16-character alphanumeric IDs, but our JSON files have IDs like "race-dwarf"
                if (jsonData._id && !jsonData._id.match(/^[a-zA-Z0-9]{16}$/)) {
                    delete jsonData._id;
                }
                
                documents.push(jsonData);
            } catch (error) {
                console.warn(`Third Era | Failed to load ${filePath}:`, error);
            }
        }

        if (documents.length > 0) {
            // Unlock the compendium if it's locked (required to create/update documents)
            if (pack.locked) {
                await pack.configure({ locked: false });
            }
            
            // Import documents into the compendium using the correct Foundry API
            // Use Document.createDocuments with pack option instead of pack.importDocuments
            const DocumentClass = pack.documentClass;
            if (!DocumentClass) {
                console.error(`Third Era | Could not determine document class for pack ${pack.collection}`);
                return;
            }
            
            // Get existing documents from the compendium to check for updates
            const existingDocs = await pack.getDocuments();
            const existingByName = new Map(existingDocs.map(doc => [doc.name, doc]));
            
            const toCreate = [];
            const toUpdate = [];
            
            for (const docData of documents) {
                const existing = existingByName.get(docData.name);
                if (existing) {
                    // Update existing document
                    toUpdate.push({_id: existing.id, ...docData});
                } else {
                    // Create new document
                    toCreate.push(docData);
                }
            }
            
            // Update existing documents
            if (toUpdate.length > 0) {
                await DocumentClass.implementation.updateDocuments(toUpdate, {pack: pack.collection});
                console.log(`Third Era | Updated ${toUpdate.length} documents in ${pack.collection}`);
            }
            
            // Create new documents
            if (toCreate.length > 0) {
                await DocumentClass.implementation.createDocuments(toCreate, {pack: pack.collection});
                console.log(`Third Era | Created ${toCreate.length} new documents in ${pack.collection}`);
            }
            
            if (toUpdate.length > 0 || toCreate.length > 0) {
                console.log(`Third Era | Processed ${documents.length} documents in ${pack.collection}`);
            }
        }
    }
}