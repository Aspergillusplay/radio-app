// server/init-db.js
import sequelize from './db.js';
import Artist from './models/artist.js';
import Track from './models/track.js';
import Playlist from './models/playlist.js';
import User from './models/user.js';
import Wish from './models/wish.js';
import TrackLikes from "./models/likes.js";
import playlist from "./models/playlist.js";

const initDb = async () => {
    playlist.addTracks = async function (tracks) {
        await this.addTracks(tracks);
        await this.save();
    };
    try {
        // Synchronize models
        await sequelize.sync({ force: true });
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

        const tracks = await Track.bulkCreate([
            {
                name: 'Burn It Down',
                path: 'Burn_It_Down.mp3',
                order: 5,
                artistId: linkinPark.id,
                group: 'B',
                likes: 100,
            },
            {
                name: 'Numb',
                path: 'Numb.mp3',
                order: 2,
                artistId: linkinPark.id,
                group: 'A',
                likes: 200,
            },
            {
                name: 'In The End',
                path: 'In_The_End.mp3',
                order: 3,
                artistId: linkinPark.id,
                group: 'A',
                likes: 300,
            },
            {
                name: 'Over The Hills And Far Away',
                path: 'Over_The_Hills_And_Far_Away.mp3',
                order: 4,
                artistId: nightwish.id,
                group: 'B',
                likes: 150,
            },
            {
                name: 'Army Of The Night',
                path: 'Army_Of_The_Night.mp3',
                order: 1,
                artistId: powerwolf.id,
                group: 'A',
                likes: 250,
            },
            {
                name: 'Demons Are A Girl\'s Best Friend',
                path: 'Demons_Are_A_Girls_Best_Friend.mp3',
                order: 6,
                artistId: powerwolf.id,
                group: 'C',
                likes: 50,
            },
            {
                name: 'We Drink Your Blood',
                path: 'We_Drink_Your_Blood.mp3',
                order: 7,
                artistId: powerwolf.id,
                group: 'C',
                likes: 75,
            },
            {
                name: 'Hero',
                path: 'Hero.mp3',
                order: 8,
                artistId: skillet.id,
                group: 'B',
                likes: 125,
            },
            {
                name: 'Legendary',
                path: 'Legendary.mp3',
                order: 9,
                artistId: skillet.id,
                group: 'B',
                likes: 175,
            },
            {
                name: 'Feel Invincible',
                path: 'Feel_Invincible.mp3',
                order: 10,
                artistId: skillet.id,
                group: 'A',
                likes: 225,
            },
        ]);

        const user1 = await User.create({
            firebaseId: 'mM0teVIaE5hUFkaHYPMY1tXTFD33',
            role: 'ADMIN',
            email: 'aspergillusplay@gmail.com',
        });

        const user2 = await User.create({
            firebaseId: 'psh1SNiJwsZC3tyWHUcRpvY63ut1',
            role: 'USER',
            email: 'kartofka123@i.ua',
        });

        // Create playlist and add tracks to the playlist
        const playlist = await Playlist.create({
            name: 'Default Playlist',
            userId: user1.id,
        });

        await playlist.addTracks(tracks);

        console.log('Database initialized with default data!');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

initDb();