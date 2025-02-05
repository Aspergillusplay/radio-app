import sequelize from '../db.js';
import User from './user.js';
import Track from './track.js';

const TrackLike = sequelize.define('TrackLike', {}, {
    timestamps: true,
});

// Связь с пользователем
TrackLike.belongsTo(User);
User.hasMany(TrackLike);

// Связь с треком
TrackLike.belongsTo(Track);
Track.hasMany(TrackLike);

export default TrackLike;
