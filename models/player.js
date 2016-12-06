module.exports = (sequelize, DataTypes) => {
    let Player = sequelize.define(
        "Player",
        {
            name:  { type: DataTypes.STRING },
            path:  { type: DataTypes.STRING },
            mov:   { type: DataTypes.INTEGER },
            score: { type: DataTypes.INTEGER },
            sos:   { type: DataTypes.FLOAT },
            rank:  { type: DataTypes.INTEGER }
        }
    );

    return Player;
};
