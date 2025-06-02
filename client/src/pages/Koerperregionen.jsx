import React from 'react';
import './Koerperregionen.css'; 
import koerperbild from '../assets/koerper-vorne-hinten.png';

function Koerperregionen() {
  return (
    <div className="koerperregionen-container">
      <h2>Körperregionen-Auswahl</h2>
      <img
  src={koerperbild}
  alt="Körperregionen"
  useMap="#koerpermap"
  className="koerperbild"
/>

<map name="koerpermap">
  {/* Kopf */}
  <area shape="rect" coords="120,40,180,130" alt="Kopf" onClick={() => alert('🧠 Kopf ausgewählt')} />
  
  {/* Brust */}
  <area shape="rect" coords="110,130,190,200" alt="Brust" onClick={() => alert('🫁 Brust ausgewählt')} />
  
  {/* Bauch */}
  <area shape="rect" coords="110,210,190,310" alt="Bauch" onClick={() => alert('🍽 Bauch ausgewählt')} />
  
  {/* Arme links */}
  <area shape="rect" coords="50,140,100,300" alt="linker Arm" onClick={() => alert('💪 Linker Arm ausgewählt')} />
  
  {/* Arme rechts */}
  <area shape="rect" coords="200,140,250,300" alt="rechter Arm" onClick={() => alert('💪 Rechter Arm ausgewählt')} />
  
  {/* Beine */}
  <area shape="rect" coords="110,320,190,500" alt="Beine" onClick={() => alert('🦵 Beine ausgewählt')} />
</map>


    </div>
  );
}

export default Koerperregionen;
