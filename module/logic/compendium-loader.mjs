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
            "feat-alertness.json", "feat-combat-reflexes.json", "feat-dodge.json",
            "feat-improved-initiative.json", "feat-point-blank-shot.json", "feat-power-attack.json",
            "feat-spell-focus.json", "feat-toughness.json", "feat-two-weapon-fighting.json",
            "feat-weapon-focus.json"
        ],
        "thirdera.thirdera_weapons": [
            "weapon-longsword.json", "weapon-shortsword.json", "weapon-dagger.json",
            "weapon-greatsword.json", "weapon-longbow.json", "weapon-shortbow.json",
            "weapon-club.json", "weapon-quarterstaff.json", "weapon-rapier.json",
            "weapon-scimitar.json"
        ],
        "thirdera.thirdera_armor": [
            "armor-leather.json", "armor-studded-leather.json", "armor-chain-shirt.json",
            "armor-scale-mail.json", "armor-chainmail.json", "armor-breastplate.json",
            "armor-splint-mail.json", "armor-bandmail.json", "armor-full-plate.json",
            "shield-buckler.json", "shield-light.json", "shield-heavy.json"
        ],
        "thirdera.thirdera_equipment": [
            "equipment-backpack.json", "equipment-bedroll.json", "equipment-rations.json",
            "equipment-waterskin.json", "equipment-torch.json", "equipment-hemp-rope.json",
            "equipment-pouch.json", "equipment-spell-component-pouch.json",
            "equipment-holy-symbol.json", "equipment-holy-symbol-silver.json"
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