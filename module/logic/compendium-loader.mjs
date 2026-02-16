/**
 * Compendium Loader
 * Loads JSON files from packs/ directories into Foundry compendiums
 */
import { parseSpellFields, applyParsedSpellFields } from "./spell-description-parser.mjs";

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
        "thirdera.thirdera_schools": [
            "school-abjuration.json", "school-conjuration.json", "school-divination.json",
            "school-enchantment.json", "school-evocation.json", "school-illusion.json",
            "school-necromancy.json", "school-transmutation.json"
        ],
        "thirdera.thirdera_domains": [
            "domain-air.json", "domain-animal.json", "domain-chaos.json", "domain-death.json",
            "domain-destruction.json", "domain-earth.json", "domain-evil.json", "domain-fire.json",
            "domain-good.json", "domain-healing.json", "domain-knowledge.json", "domain-law.json",
            "domain-luck.json", "domain-magic.json", "domain-plant.json", "domain-protection.json",
            "domain-strength.json", "domain-sun.json", "domain-travel.json", "domain-trickery.json",
            "domain-war.json", "domain-water.json"
        ],
        "thirdera.thirdera_spells": [
            "spell-acid-arrow.json", "spell-acid-splash.json", "spell-aid.json", "spell-alarm.json",
            "spell-align-weapon.json", "spell-alter-self.json", "spell-animal-messenger.json", "spell-animate-dead.json",
            "spell-animate-rope.json", "spell-arcane-lock.json", "spell-arcane-mark.json", "spell-arcane-sight.json",
            "spell-augury.json", "spell-bane.json", "spell-barkskin.json", "spell-bears-endurance.json",
            "spell-bestow-curse.json", "spell-bless.json", "spell-bless-water.json", "spell-bless-weapon.json",
            "spell-blindness-deafness.json", "spell-blink.json", "spell-blur.json", "spell-bulls-strength.json",
            "spell-burning-hands.json", "spell-call-lightning.json", "spell-calm-animals.json", "spell-calm-emotions.json",
            "spell-cats-grace.json", "spell-cause-fear.json", "spell-charm-animal.json", "spell-charm-monster.json",
            "spell-charm-person.json", "spell-chill-touch.json", "spell-clairaudience-clairvoyance.json", "spell-color-spray.json",
            "spell-command.json", "spell-command-plants.json", "spell-command-undead.json", "spell-comprehend-languages.json",
            "spell-confusion.json", "spell-confusion-lesser.json", "spell-consecrate.json", "spell-contagion.json",
            "spell-continual-flame.json", "spell-create-food-and-water.json", "spell-create-water.json", "spell-crushing-despair.json",
            "spell-cure-light-wounds.json", "spell-cure-moderate-wounds.json", "spell-cure-serious-wounds.json", "spell-curse-water.json",
            "spell-dancing-lights.json", "spell-darkness.json", "spell-darkvision.json", "spell-daylight.json",
            "spell-daze.json", "spell-daze-monster.json", "spell-death-knell.json", "spell-deathwatch.json",
            "spell-deeper-darkness.json", "spell-deep-slumber.json", "spell-delay-poison.json", "spell-desecrate.json",
            "spell-detect-animals-or-plants.json", "spell-detect-chaos.json", "spell-detect-evil.json", "spell-detect-good.json",
            "spell-detect-law.json", "spell-detect-magic.json", "spell-detect-poison.json", "spell-detect-secret-doors.json",
            "spell-detect-snares-and-pits.json", "spell-detect-thoughts.json", "spell-detect-undead.json", "spell-diminish-plants.json",
            "spell-discern-lies.json", "spell-disguise-self.json", "spell-dispel-magic.json", "spell-displacement.json",
            "spell-disrupt-undead.json", "spell-divine-favor.json", "spell-dominate-animal.json", "spell-doom.json",
            "spell-eagles-splendor.json", "spell-endure-elements.json", "spell-enlarge-person.json", "spell-entangle.json",
            "spell-enthrall.json", "spell-entropic-shield.json", "spell-erase.json", "spell-expeditious-retreat.json",
            "spell-explosive-runes.json", "spell-faerie-fire.json", "spell-false-life.json", "spell-fear.json",
            "spell-feather-fall.json", "spell-find-traps.json", "spell-fireball.json", "spell-flame-arrow.json",
            "spell-flaming-sphere.json", "spell-flare.json", "spell-floating-disk.json", "spell-fly.json",
            "spell-fog-cloud.json", "spell-foxs-cunning.json", "spell-gaseous-form.json", "spell-geas-lesser.json",
            "spell-gentle-repose.json", "spell-ghost-sound.json", "spell-ghoul-touch.json", "spell-glibness.json",
            "spell-glitterdust.json", "spell-glyph-of-warding.json", "spell-goodberry.json", "spell-good-hope.json",
            "spell-grease.json", "spell-gust-of-wind.json", "spell-halt-undead.json", "spell-haste.json",
            "spell-heal.json", "spell-heal-mount.json", "spell-heat-metal.json", "spell-helping-hand.json",
            "spell-heroism.json", "spell-hide-from-animals.json", "spell-hide-from-undead.json", "spell-hideous-laughter.json", "spell-hold-animal.json",
            "spell-hold-person.json", "spell-hold-portal.json", "spell-hypnotic-pattern.json", "spell-hypnotism.json",
            "spell-identify.json", "spell-illusory-script.json", "spell-inflict-light-wounds.json", "spell-inflict-moderate-wounds.json",
            "spell-inflict-serious-wounds.json", "spell-invisibility.json", "spell-invisibility-purge.json", "spell-invisibility-sphere.json",
            "spell-jump.json", "spell-keen-edge.json", "spell-knock.json", "spell-levitate.json",
            "spell-light.json", "spell-lightning-bolt.json", "spell-locate-object.json", "spell-longstrider.json",
            "spell-mage-armor.json", "spell-mage-hand.json", "spell-magic-aura.json", "spell-magic-circle-against-chaos.json",
            "spell-magic-circle-against-evil.json", "spell-magic-circle-against-good.json", "spell-magic-circle-against-law.json",
            "spell-magic-fang-greater.json", "spell-magic-fang.json", "spell-magic-missile.json", "spell-magic-mouth.json",
            "spell-magic-stone.json", "spell-magic-vestment.json", "spell-magic-weapon-greater.json", "spell-magic-weapon.json",
            "spell-major-image.json", "spell-make-whole.json", "spell-meld-into-stone.json", "spell-mending.json",
            "spell-message.json", "spell-minor-image.json", "spell-mirror-image.json", "spell-misdirection.json",
            "spell-mount.json", "spell-neutralize-poison.json", "spell-nondetection.json", "spell-obscure-object.json",
            "spell-obscuring-mist.json", "spell-open-close.json", "spell-owls-wisdom.json", "spell-pass-without-trace.json",
            "spell-phantom-steed.json", "spell-phantom-trap.json", "spell-plant-growth.json", "spell-poison.json",
            "spell-prayer.json", "spell-prestidigitation.json", "spell-produce-flame.json", "spell-protection-from-arrows.json",
            "spell-protection-from-chaos.json", "spell-protection-from-energy.json", "spell-protection-from-evil.json",
            "spell-protection-from-good.json", "spell-protection-from-law.json", "spell-pyrotechnics.json",
            "spell-quench.json", "spell-rage.json", "spell-ray-of-enfeeblement.json", "spell-ray-of-exhaustion.json",
            "spell-ray-of-frost.json", "spell-read-magic.json", "spell-reduce-animal.json", "spell-reduce-person.json",
            "spell-remove-blindness-deafness.json", "spell-remove-curse.json", "spell-remove-disease.json", "spell-remove-fear.json",
            "spell-remove-paralysis.json", "spell-repel-vermin.json", "spell-resistance.json", "spell-resist-energy.json",
            "spell-restoration-lesser.json", "spell-rope-trick.json", "spell-sanctuary.json", "spell-scare.json",
            "spell-scorching-ray.json", "spell-scrying.json", "spell-sculpt-sound.json", "spell-searing-light.json",
            "spell-secret-page.json", "spell-see-invisibility.json", "spell-sepia-snake-sigil.json", "spell-shatter.json",
            "spell-shield.json", "spell-shield-of-faith.json", "spell-shield-other.json", "spell-shillelagh.json",
            "spell-shocking-grasp.json", "spell-shrink-item.json", "spell-silence.json", "spell-silent-image.json",
            "spell-sleep.json", "spell-sleet-storm.json", "spell-slow.json", "spell-snare.json",
            "spell-soften-earth-and-stone.json", "spell-sound-burst.json", "spell-speak-with-animals.json", "spell-speak-with-dead.json",
            "spell-speak-with-plants.json", "spell-spectral-hand.json", "spell-spider-climb.json", "spell-spike-growth.json",
            "spell-spiritual-weapon.json", "spell-status.json", "spell-stinking-cloud.json", "spell-stone-shape.json",
            "spell-suggestion.json", "spell-summon-monster-i.json", "spell-summon-monster-ii.json", "spell-summon-monster-iii.json",
            "spell-summon-natures-ally-i.json", "spell-summon-natures-ally-ii.json", "spell-summon-natures-ally-iii.json",
            "spell-summon-swarm.json", "spell-tiny-hut.json", "spell-tongues.json", "spell-touch-of-fatigue.json",
            "spell-touch-of-idiocy.json", "spell-tree-shape.json", "spell-true-strike.json", "spell-undetectable-alignment.json",
            "spell-unseen-servant.json", "spell-vampiric-touch.json", "spell-ventriloquism.json", "spell-virtue.json",
            "spell-water-breathing.json", "spell-water-walk.json", "spell-web.json", "spell-whispering-wind.json",
            "spell-wind-wall.json", "spell-zone-of-truth.json"
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
                
                // Spells: populate Range, Target, Duration, Saving Throw from description when blank or "See text"
                if (jsonData.type === "spell" && jsonData.system) {
                    const current = {
                        range: jsonData.system.range,
                        target: jsonData.system.target,
                        duration: jsonData.system.duration,
                        savingThrow: jsonData.system.savingThrow
                    };
                    const parsed = parseSpellFields(
                        jsonData.system.description || "",
                        jsonData.name,
                        current
                    );
                    applyParsedSpellFields(jsonData.system, parsed);
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