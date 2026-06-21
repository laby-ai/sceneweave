import type { EntityCard } from '@/lib/film-creation-panel-model';

export function buildFilmReferenceImages(
  card: EntityCard,
  entityCards: EntityCard[],
  continuityRef?: string,
): string[] {
  const refs: string[] = [];
  if (continuityRef) {
    refs.push(continuityRef);
  }

  if (card.characters?.length) {
    const charCards = entityCards.filter(c => c.type === 'character' && card.characters?.includes(c.name || ''));
    for (const cc of charCards) {
      const activeOutfit = cc.wardrobeOutfits?.[cc.activeOutfitIndex ?? 0];
      if (activeOutfit?.imageUrl) {
        refs.push(activeOutfit.imageUrl);
      } else if (cc.imageUrl) {
        refs.push(cc.imageUrl);
      }
    }
  }

  if (card.sceneId) {
    const sceneCard = entityCards.find(c => c.id === card.sceneId);
    if (sceneCard?.imageUrl) {
      refs.push(sceneCard.imageUrl);
    }
  }

  if (card.type === 'shot') {
    const propCards = entityCards.filter(c => c.type === 'prop' && c.imageUrl);
    const shotText = `${card.promptCn || ''} ${card.action || ''} ${card.dialogue || ''} ${card.narration || ''}`.toLowerCase();
    for (const pc of propCards) {
      if (shotText.includes((pc.name || '').toLowerCase()) || pc.propCloseup) {
        refs.push(pc.imageUrl!);
      }
    }
  }

  return refs;
}

export function buildFilmAnchorContext(card: EntityCard, entityCards: EntityCard[]): string {
  const ctx: string[] = [];

  if (card.characters?.length) {
    const charCards = entityCards.filter(c => c.type === 'character' && card.characters?.includes(c.name || ''));
    for (const cc of charCards) {
      if (cc.anchor) {
        ctx.push(`character ${cc.name}: ${cc.anchor.faceAnchor?.faceShape || ''} face, ${cc.anchor.costumeAnchor?.mainOutfit || ''} outfit`);
      }
      const activeOutfit = cc.wardrobeOutfits?.[cc.activeOutfitIndex ?? 0];
      if (activeOutfit?.description) {
        ctx.push(`${cc.name} wearing: ${activeOutfit.description}`);
      }
    }
  }

  if (card.sceneId) {
    const sceneCard = entityCards.find(c => c.id === card.sceneId);
    if (sceneCard?.imageUrl) {
      ctx.push(`scene: ${sceneCard.name}, ${sceneCard.mood || ''} atmosphere`);
    }
  }

  if (card.type === 'shot') {
    const propCards = entityCards.filter(c => c.type === 'prop' && c.imageUrl);
    const shotText = `${card.promptCn || ''} ${card.action || ''} ${card.dialogue || ''} ${card.narration || ''}`.toLowerCase();
    for (const pc of propCards) {
      if (shotText.includes((pc.name || '').toLowerCase()) || pc.propCloseup) {
        ctx.push(`prop: ${pc.name}, ${pc.propMaterial || ''} ${pc.propColor || ''}, ${pc.propSignificance || ''}`);
      }
    }
  }

  return ctx.length > 0 ? `, ${ctx.join(', ')}` : '';
}
