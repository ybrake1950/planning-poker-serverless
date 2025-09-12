// serverless/game.js - Game logic handlers (pay-per-action)

exports.joinSession = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Join session - serverless backend ready' })
  };
};

exports.castVote = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Vote casting - serverless backend ready' })
  };
};

exports.resetVotes = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Vote reset - serverless backend ready' })
  };
};
