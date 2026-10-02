import React, { useMemo } from 'react';
import { useDataStore } from '../context/DataContext';
import PartnerTable from './PartnerTable';
import InfoTip from './InfoTip';

/* в”Ђв”Ђ Р‘Р»РѕРє В«РРЅСЃС‚Р°Р»СЏС†РёРёВ» РЅР° РґР°С€Р±РѕСЂРґРµ (РІРєР»Р°РґРєР° В«РЎРІРѕРґРєР°В»).
 * РўР° Р¶Рµ С‚Р°Р±Р»РёС†Р°, С‡С‚Рѕ Рё Сѓ РїСЂРѕРґ-РїСЂРѕРµРєС‚РѕРІ (PartnerTable, variant='installations'):
 * РІСЃРµ РєРѕР»РѕРЅРєРё (Р’СЃРµРіРѕ РџРЈ, РђРєС‚РёРІРЅС‹С…, РўРћ СЃРµРіРѕРґРЅСЏ/РІС‡РµСЂР°/3 РґРЅСЏ, Р Р°Р·СЂС‹РІ, Р‘РЎ, РЎСЂРµР· Р‘Р”),
 * СЃРѕСЂС‚РёСЂРѕРІРєР°, РїРѕРёСЃРє Рё С†РІРµС‚РѕРІР°СЏ РёРЅРґРёРєР°С†РёСЏ вЂ” РёРґРµРЅС‚РёС‡РЅС‹ РїСЂРѕРґ-С‚Р°Р±Р»РёС†Рµ.
 */
export default function InstallationsBlock() {
  const { installations } = useDataStore();

  const instList = useMemo(
    () => (installations || []).filter(i => i.category !== 'prod' && i.monitor !== false),
    [installations],
  );

  if (instList.length === 0) return null;

  return (
    <>
      <div className="section-title">
        рџЏ  РЎРІРѕРґРєР° РїРѕ РёРЅСЃС‚Р°Р»СЏС†РёСЏРј
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          background: 'rgba(251,191,36,0.12)', color: '#fcd34d',
          border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
          marginLeft: 8, verticalAlign: 'middle',
        }}>РёРЅСЃС‚Р°Р»СЏС†РёРё</span>
        <InfoTip
          title="РЎРІРѕРґРєР° РїРѕ РёРЅСЃС‚Р°Р»СЏС†РёСЏРј"
          text={'РўРµ Р¶Рµ РєРѕР»РѕРЅРєРё Рё С†РІРµС‚РѕРІР°СЏ РёРЅРґРёРєР°С†РёСЏ, С‡С‚Рѕ Рё Сѓ РїСЂРѕРґ-РїСЂРѕРµРєС‚РѕРІ.\nРРЅСЃС‚Р°Р»СЏС†РёСЏ вЂ” Р°РіСЂРµРіР°С‚ РїРѕ РІСЃРµР№ РїР»РѕС‰Р°РґРєРµ (Р±РµР· СЂР°Р·Р±РёРІРєРё РїРѕ РїР°СЂС‚РЅС‘СЂР°Рј): РјРµС‚СЂРёРєРё РёР· РµС‘ Р±Р°Р· SG/SG2/MS.'}
        />
      </div>
      <PartnerTable variant="installations" />
    </>
  );
}
