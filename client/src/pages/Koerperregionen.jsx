import React from 'react';
import './Koerperregionen.css'; 

function Koerperregionen() {
  return (
    <div className="koerperregionen-container">
      <h2>Körperregionen-Auswahl</h2>
      <img
        src="/images/koerper-vorne-hinten.png"
        alt="Körperregion auswählen"
        className="koerperbild"
      />
    </div>
  );
}

export default Koerperregionen;
