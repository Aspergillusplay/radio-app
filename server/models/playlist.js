import { DataTypes } from 'sequelize';
import sequelize from '../db.js';
import User from './user.js';
import Track from './track.js';

const Playlist = sequelize.define('Playlist', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: false,
});

Playlist.belongsTo(User);
User.hasMany(Playlist);

Playlist.belongsToMany(Track, { through: 'PlaylistTracks' });
Track.belongsToMany(Playlist, { through: 'PlaylistTracks' });

export default Playlist;
