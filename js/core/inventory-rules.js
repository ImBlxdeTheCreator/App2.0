/* Shared Destiny inventory classification and presentation rules.
   Keep Bungie's raw profile data unchanged; these helpers only control how
   D2Synergy presents and routes items across Vault, Activities, and Builder. */
(function(){
  'use strict';
  const BUCKETS=Object.freeze({
    POSTMASTER:215593132,
    QUESTS:1801258597,
    CLAN_BANNER:497170007,
    DESTINATION_CURRENCY:Object.freeze([370330657,3703306570,3703306568,2207872501]),
    HIDDEN:Object.freeze([1753109658,2422292810,3621873013,444348033,3284755031])
  });
  const destinationCurrency=new Set(BUCKETS.DESTINATION_CURRENCY);
  const hidden=new Set(BUCKETS.HIDDEN);
  function hashFor(item){return Number(item?.bucketHash||item?._def?.bucketHash||item?.inventory?.bucketTypeHash||0);}
  function definitionText(item,bucketName=''){
    const d=item?._def||item||{};
    return `${bucketName} ${d.typeName||''} ${d.itemTypeDisplayName||''} ${d.itemTypeAndTierDisplayName||''} ${d.name||d.displayProperties?.name||''} ${d.description||d.displayProperties?.description||''}`.toLowerCase();
  }
  function isQuest(item,bucketName=''){
    return hashFor(item)===BUCKETS.QUESTS||/(^|\b)(quest|quests|bounty|bounties|pursuit|pursuits|mission|missions)(\b|$)/.test(definitionText(item,bucketName));
  }
  function isSubclassOrArtifact(item,bucketName=''){
    return /(^|\b)(subclass|seasonal artifact|artifact)(\b|$)/.test(definitionText(item,bucketName));
  }
  function isHidden(item){return hidden.has(hashFor(item));}
  function excludedFromVault(item,bucketName=''){return isHidden(item)||isQuest(item,bucketName)||isSubclassOrArtifact(item,bucketName);}
  function isDestinationCurrency(item){return destinationCurrency.has(hashFor(item));}
  function isClanBanner(item){return hashFor(item)===BUCKETS.CLAN_BANNER;}
  function assetType(item,bucketName=''){
    const d=item?._def||item||{},text=definitionText(item,bucketName);
    if(d.itemType===3)return 'weapon'; if(d.itemType===2)return 'armor';
    if(/engram/.test(text))return 'engram'; if(isQuest(item,bucketName))return 'quest';
    if(/currency|material|token|consumable/.test(text))return /currency/.test(text)?'currency':'material';
    if(/emblem|clan banner/.test(text))return 'emblem'; if(/ghost/.test(text))return 'ghost';
    if(/sparrow|vehicle/.test(text))return 'sparrow'; if(/ship/.test(text))return 'ship'; if(/shader/.test(text))return 'shader';
    if(/modification|\bmod\b/.test(text))return 'mod'; return 'universal';
  }
  window.D2InventoryRules={BUCKETS,hashFor,definitionText,isQuest,isSubclassOrArtifact,isHidden,excludedFromVault,isDestinationCurrency,isClanBanner,assetType};
})();
