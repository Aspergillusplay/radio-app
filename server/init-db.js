// server/init-db.js
import sequelize from './db.js';
import Artist from './models/artist.js';
import Track from './models/track.js';
import Playlist from './models/playlist.js';
import User from './models/user.js';

const initDb = async () => {
    try {
        // Synchronize models
        await sequelize.sync({force: true});  // force: true will drop tables on start

        console.log('Database synced!');

        const linkinPark = await Artist.create({
            name: 'Linkin Park',
            image: 'linkinpark.jpg',
        });

        const nightwish = await Artist.create({
            name: 'Nightwish',
            image: 'nightwish.jpg',
        });

        const powerwolf = await Artist.create({
            name: 'Powerwolf',
            image: 'powerwolf.jpg',
        });

        const skillet = await Artist.create({
            name: 'Skillet',
            image: 'skillet.jpg',
        });

        await Track.bulkCreate([
            {
                name: 'Burn It Down',
                path: 'linkin-park-burn-it-down.mp3',
                order: 1,
                artistId: linkinPark.id,
            },
            {
                name: 'Numb',
                path: 'linkin-park-numb.mp3',
                order: 2,
                artistId: linkinPark.id,
            },
            {
                name: 'In The End',
                path: 'linkin-park-in-the-end.mp3',
                order: 3,
                artistId: linkinPark.id,
            },
            {
                name: 'Over The Hills And Far Away',
                path: 'Nightwish-Over-The-Hils-And-Far-Away.mp3',
                order: 4,
                artistId: nightwish.id,
            },
            {
                name: 'Army Of The Night',
                path: 'Powerwolf-Army Of The Night.mp3',
                order: 5,
                artistId: powerwolf.id,
            },
            {
                name: 'Demons Are A Girl\'s Best Friend',
                path: 'Powerwolf-Demon`s Are A Girl`s Best Friends.mp3',
                order: 6,
                artistId: powerwolf.id,
            },
            {
                name: 'We Drink Your Blood',
                path: 'Powerwolf-We Drink Your Blood.mp3',
                order: 7,
                artistId: powerwolf.id,
            },
            {
                name: 'Hero',
                path: 'skillet_-_hero.mp3',
                order: 8,
                artistId: skillet.id,
            },
            {
                name: 'Legendary',
                path: 'skillet_-_legendary.mp3',
                order: 9,
                artistId: skillet.id,
            },
            {
                name: 'Feel Invincible',
                path: 'skillet_-_feel-invincible.mp3',
                order: 10,
                artistId: skillet.id,
            },
        ]);

        // Add user
        const user = await User.create({
            firebaseId: 'user_id',  // Replace with the ID obtained from Firebase
            role: 'ADMIN',
        });

        // Create playlist for user
        const playlist = await Playlist.create({
            name: 'My Playlist',
            userId: user.id,
        });

        // Add tracks to playlist
        await playlist.addTracks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        console.log('Database initialized with default data!');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

initDb();