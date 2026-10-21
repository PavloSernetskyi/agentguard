import {useId} from 'react';
export function Art({kind, color, name}: {kind: string; color: string; name: string}) {
  const id = useId();
  return <svg className="product-art" viewBox="0 0 320 250" role="img" aria-label={name} style={{background: color}}>
    <defs><filter id={id}><feDropShadow dx="0" dy="10" stdDeviation="7" floodOpacity=".15"/></filter></defs>
    <ellipse cx="160" cy="209" rx="73" ry="9" fill="#142b35" opacity=".07"/>
    <g filter={`url(#${id})`} strokeLinejoin="round">
    {kind === 'headphones' && <><path d="M100 145V105a60 60 0 01120 0v40" fill="none" stroke="#244d49" strokeWidth="20"/><path d="M100 107a60 60 0 01120 0" fill="none" stroke="#78a49a" strokeWidth="7"/><rect x="85" y="125" width="39" height="69" rx="18" fill="#173b38" transform="rotate(-8 105 155)"/><rect x="196" y="125" width="39" height="69" rx="18" fill="#173b38" transform="rotate(8 215 155)"/></>}
    {kind === 'backpack' && <><path d="M139 66V54q21-22 42 0v12" fill="none" stroke="#80603f" strokeWidth="9"/><rect x="103" y="64" width="114" height="144" rx="31" fill="#b38b60"/><path d="M110 104h100" stroke="#d9bb8e" strokeWidth="4"/><rect x="119" y="134" width="82" height="57" rx="12" fill="#987349"/><path d="M129 148h62" stroke="#ddc39c" strokeWidth="3"/><rect x="149" y="91" width="23" height="18" rx="3" fill="#f0e7d4"/></>}
    {kind === 'mug' && <><ellipse cx="162" cy="199" rx="72" ry="9" fill="#c6a38b"/><path d="M202 104h20q35 45-20 55" fill="none" stroke="#ac684e" strokeWidth="15"/><path d="M103 92h105l-9 89q-38 32-87 0z" fill="#bd795b"/><ellipse cx="156" cy="92" rx="53" ry="12" fill="#e5b297"/><ellipse cx="156" cy="92" rx="43" ry="7" fill="#6a4435"/></>}
    {kind === 'lamp' && <><ellipse cx="159" cy="199" rx="56" ry="10" fill="#676d49"/><path d="M159 195V110l31-37" stroke="#676d49" strokeWidth="10" fill="none"/><path d="M136 91q-8-60 49-49l35 48z" fill="#87916b"/><path d="M137 92h83" stroke="#ede4b4" strokeWidth="6"/></>}
    {kind === 'bottle' && <><rect x="133" y="45" width="54" height="29" rx="7" fill="#234d56"/><rect x="124" y="68" width="72" height="137" rx="23" fill="#4c8994"/><path d="M136 93v84" stroke="#82b1b7" strokeWidth="6" strokeLinecap="round"/><path d="M146 137h28" stroke="#dceaea" strokeWidth="3"/></>}
    {kind === 'speaker' && <><rect x="96" y="82" width="128" height="119" rx="24" fill="#545773"/><rect x="105" y="99" width="110" height="91" rx="15" fill="#3f425d"/>{Array.from({length: 8}, (_,i) => <path key={i} d={`M116 ${110+i*9}h88`} stroke="#73758a" strokeWidth="2"/>)}<circle cx="161" cy="90" r="3" fill="#e6dec7"/></>}
    {kind === 'throw' && <><path d="M90 80l126-14 14 125-128 17z" fill="#b47760"/><path d="M89 111l132-14M94 149l131-14M99 187l128-15" stroke="#deb8a2" strokeWidth="14"/><path d="M113 79l13 122M155 72l13 125M196 68l13 125" stroke="#d09b80" strokeWidth="8"/></>}
    {kind === 'notebook' && <><rect x="104" y="61" width="109" height="147" rx="5" fill="#b4b990" transform="rotate(10 160 130)"/><rect x="95" y="51" width="109" height="147" rx="5" fill="#4d6c57"/><path d="M109 51v147" stroke="#334e3c" strokeWidth="4"/><path d="M129 99h48M129 112h29" stroke="#c4d2b6" strokeWidth="3"/></>}
    {kind === 'mouse' && <><rect x="117" y="59" width="87" height="143" rx="43" fill="#f4f0e8"/><path d="M160 59v55M118 116h85" stroke="#d0cec8" strokeWidth="2"/><rect x="155" y="82" width="10" height="24" rx="5" fill="#6a7c83"/></>}
    {kind === 'pens' && <>{['#355b57','#bd7555','#d3b263','#687a91','#554b63'].map((c,i)=><g key={c} transform={`rotate(12 ${110+i*25} 130)`}><rect x={98+i*25} y="62" width="13" height="126" rx="5" fill={c}/><path d={`M${98+i*25} 184l6 19 7-19`} fill="#e5d6b8"/><path d={`M${104+i*25} 68v31`} stroke="#f0e6d5" strokeWidth="2"/></g>)}</>}
    </g></svg>;
}
