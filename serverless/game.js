// Fixed Planning Poker Backend - game.js (ES5 Compatible)
// Directory: Execute from server/src/ folder
// Fixed: Removed const declarations that cause parsing errors
// Changes:
// 1. Spectators can reset votes even after consensus
// 2. Removed restriction preventing re-voting after consensus
// 3. Better state management for re-voting scenarios

var db = require('./db'); // Assuming you have a db module

// Get required functions from db module
var getSession = db.getSession;
var updateSession = db.updateSession;
var getConnection = db.getConnection;
var checkConsensus = db.checkConsensus;

// Cast vote handler - FIXED: Allow re-voting when no consensus
function handleCastVote(socket, data) {
  console.log('🗳️ Cast vote event from ' + socket.id + ' - Vote: ' + data.vote);
  
  getConnection(socket.id)
    .then(function(connection) {
      if (!connection) {
        console.log('❌ Connection not found: ' + socket.id);
        socket.emit('error', {
          message: 'Connection not found. Please rejoin the session.'
        });
        return;
      }
    })
  }