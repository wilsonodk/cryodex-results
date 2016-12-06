module.exports = (sequelize, DataTypes) => {
    let Match = sequelize.define(
        "Match",
        {
            label:         { type: DataTypes.STRING },
            roundType:     { type: DataTypes.STRING },
            roundNumber:   { type: DataTypes.INTEGER },
            table:         { type: DataTypes.INTEGER },
            player1:       { type: DataTypes.STRING },
            player1points: { type: DataTypes.INTEGER },
            player2:       { type: DataTypes.STRING },
            player2points: { type: DataTypes.INTEGER}
        }
    );

    return Match;
}
