// ==== DECKS FROM XLSX ====
const nounsDeck = [
  'Cat', 'Dog', 'Elephant', 'Tiger', 'Giraffe', 'Lion', 'Monkey', 'Dolphin', 'Penguin', 'Kangaroo', 'Zebra', 'Panda', 'Bear', 'Horse', 'Rabbit', 'Owl', 'Snake', 'Crocodile', 'Fox', 'Koala', 'Octopus', 'Peacock', 'Squirrel', 'Gorilla', 'Hippopotamus', 'Ostrich', 'Rhinoceros', 'Turtle', 'Seahorse', 'Jellyfish', 'Lobster', 'Platypus', 'Cheetah', 'Chimpanzee', 'Camel', 'Meerkat', 'Flamingo', 'Parrot', 'Salmon', 'Shark', 'Butterfly', 'Penguin', 'Gazelle', 'Raccoon', 'Mouse', 'Bat', 'Eagle', 'Antelope', 'Snail', 'Wolf', 'Llama', 'Hedgehog', 'Walrus', 'Bison', 'Giraffe', 'Otter', 'Puma', 'Hyena', 'Toucan', 'Ocelot', 'Lemur', 'Chameleon', 'Kangaroo', 'Oryx', 'Anteater', 'Peacock', 'Tapir', 'Orangutan', 'Baboon', 'Wombat', 'Caracal', 'Armadillo', 'Caiman', 'Rattlesnake', 'Quokka', 'Komodo Dragon', 'Gorilla', 'Narwhal', 'Flamingo', 'Sloth', 'Panther', 'Hedgehog', 'Rhinoceros', 'Seal', 'Crab', 'Koala', 'Donkey', 'Vulture', 'Jackal', 'Skunk', 'Chinchilla', 'Ibex', 'Lemur', 'Cassowary', 'Manatee', 'Puffin', 'Wombat', 'Axolotl', 'Fennec Fox', 'Ostrich', 'Doctor', 'Teacher', 'Engineer', 'Chef', 'Pilot', 'Lawyer', 'Photographer', 'Writer', 'Musician', 'Carpenter', 'Scientist', 'Artist', 'Nurse', 'Athlete', 'Actor', 'Astronaut', 'Firefighter', 'Police Officer', 'Farmer', 'Architect', 'Veterinarian', 'Designer', 'Dentist', 'Electrician', 'Journalist', 'Librarian', 'Mechanic', 'Psychologist', 'Accountant', 'Programmer', 'Surgeon', 'Economist', 'Filmmaker', 'Historian', 'Pharmacist', 'Baker', 'Fashion Designer', 'Geologist', 'Illustrator', 'Marketing Manager', 'Professor', 'Social Worker', 'Flight Attendant', 'Economist', 'Yoga Instructor', 'Marine Biologist', 'Park Ranger', 'Tour Guide', 'Translator', 'Wedding Planner', 'Barista', 'Chemist', 'Coach', 'Environmentalist', 'Hair Stylist', 'Magician', 'Plumber', 'Radiologist', 'Salesperson', 'Bartender', 'Coach', 'Event Planner', 'Human Resources Manager', 'News Anchor', 'Physical Therapist', 'Realtor', 'Speech Therapist', 'Tattoo Artist', 'Archaeologist', 'Botanist', 'DJ', 'Florist', 'Investment Banker', 'Nutritionist', 'Pilot', 'Zookeeper', 'Barista', 'Consultant', 'Geneticist', 'Illustrator', 'Meteorologist', 'Pediatrician', 'Software Developer', 'Teacher', 'Veterinarian', 'Writer', 'Actor', 'Biologist', 'Coach', 'Economist', 'Farmer', 'Graphic Designer', 'Journalist', 'Lawyer', 'Mechanic', 'Nurse', 'Photographer', 'Scientist', 'Teacher', 'Veterinarian', 'Apple', 'Banana', 'Orange', 'Strawberry', 'Watermelon', 'Pineapple', 'Grapes', 'Blueberry', 'Mango', 'Kiwi', 'Peach', 'Pear', 'Cherry', 'Raspberry', 'Lemon', 'Lime', 'Avocado', 'Tomato', 'Cucumber', 'Carrot', 'Broccoli', 'Spinach', 'Lettuce', 'Potato', 'Onion', 'Garlic', 'Bell Pepper', 'Mushroom', 'Celery', 'Corn', 'Eggplant', 'Zucchini', 'Pumpkin', 'Radish', 'Cauliflower', 'Asparagus', 'Water', 'Milk', 'Tea', 'Coffee', 'Orange Juice', 'Apple Juice', 'Grape Juice', 'Lemonade', 'Soda', 'Energy Drink', 'Smoothie', 'Hot Chocolate', 'Coconut Water', 'Almond Milk', 'Soy Milk', 'Yogurt', 'Cheese', 'Bread', 'Rice', 'Pasta', 'Pizza', 'Hamburger', 'Hot Dog', 'Sandwich', 'Salad', 'Soup', 'Sushi', 'Fried Chicken', 'Steak', 'Fish', 'Shrimp', 'Lobster', 'Crab', 'Bacon', 'Eggs', 'Pancakes', 'Waffles', 'Omelette', 'French Fries', 'Onion Rings', 'Nachos', 'Popcorn', 'Ice Cream', 'Cake', 'Cupcake', 'Chocolate', 'Candy', 'Cookie', 'Brownie', 'Donut', 'Pie', 'Pudding', 'Muffin', 'Croissant', 'Bagel', 'Pretzel', 'Cereal', 'Granola', 'Oatmeal', 'Honey', 'Jam', 'Nutella', 'Peanut Butter', 'Maple Syrup', 'Chair', 'Table', 'Lamp', 'Book', 'Pen', 'Pencil', 'Notebook', 'Clock', 'Computer', 'Phone', 'Television', 'Remote Control', 'Glasses', 'Camera', 'Wallet', 'Keys', 'Bag', 'Shoes', 'Hat', 'Shirt', 'Pants', 'Dress', 'Coat', 'Umbrella', 'Backpack', 'Suitcase', 'Mirror', 'Brush', 'Toothbrush', 'Toothpaste', 'Soap', 'Towel', 'Shampoo', 'Conditioner', 'Razor', 'Perfume', 'Watch', 'Earrings', 'Necklace', 'Bracelet', 'Ring', 'Headphones', 'Speaker', 'Guitar', 'Drum', 'Piano', 'Microphone', 'Wallet', 'Sunglasses', 'Camera', 'Bicycle', 'Car', 'Motorcycle', 'Train', 'Airplane', 'Boat', 'Helmet', 'Compass', 'Map', 'Binoculars', 'Tent', 'Sleeping Bag', 'Camping Stove', 'Backpack', 'Hiking Boots', 'Hammock', 'Picnic Basket', 'Cooler', 'Fishing Rod', 'Surfboard', 'Skateboard', 'Scooter', 'Balloon', 'Kite', 'Puzzle', 'Board Game', 'Playing Cards', "Rubik's Cube", 'Chess Set', 'Lego', 'Toy Car', 'Doll', 'Action Figure', 'Teddy Bear', 'Soccer Ball', 'Basketball', 'Football', 'Tennis Racket', 'Golf Club', 'Baseball Bat', 'Frisbee', 'Jump Rope', 'Hula Hoop', 'Skate', 'Rollerblades', 'Tennis Ball', 'Pool Cue', 'Bowling Ball', 'Dartboard', 'Paintbrush', 'Canvas', 'Easel', 'Sculpture', 'Pottery Wheel', 'Hammer', 'Screwdriver', 'Wrench', 'Drill', 'Saw', 'Tape Measure', 'Nails', 'Screw', 'Rope', 'Glue', 'Scissors', 'Needle', 'Thread', 'Sewing Machine', 'Fabric', 'Button', 'Zipper', 'Stapler', 'Paper Clips', 'Binder', 'Calculator', 'Eraser', 'Ruler', 'Glitter', 'Paint', 'Palette', 'Canvas', 'Frame', 'Glue Gun', 'Beads', 'Ribbon', 'Sequins', 'Stickers', 'Envelope', 'Postcard', 'Stamp', 'Magnifying Glass', 'Binoculars', 'Telescope', 'Microscope', 'Lab Coat', 'Petri Dish', 'Test Tube', 'Bunsen Burner', 'Thermometer', 'Safety Goggles', 'Graduated Cylinder', 'Beaker', 'Pipette', 'Erlenmeyer Flask', 'Magnet', 'Battery', 'Circuit Board', 'Wire', 'Light Bulb', 'Switch', 'Plug', 'Outlet', 'Extension Cord', 'Fan', 'Air Conditioner', 'Heater', 'Vacuum Cleaner', 'Blender', 'Coffee Maker', 'Toaster', 'Microwave', 'Oven', 'Refrigerator', 'Washing Machine', 'Dryer', 'Iron', 'Hairdryer', 'Scale', 'Thermos', 'Pots and Pans', 'Cutting Board', 'Knife', 'Fork', 'Spoon', 'Plate', 'Bowl', 'Cup', 'Glass', 'Mug', 'Napkin', 'Tablecloth', 'Placemat', 'Candle', 'Matches', 'Lighter', 'Vase', 'Flower', 'Picture Frame', 'Candle Holder', 'Statue', 'Basketball Player', 'Tennis Player', 'Golfer', 'Swimmer', 'Soccer Player', 'Runner', 'Cyclist', 'Gymnast', 'Skier', 'Surfer', 'Baseball Player', 'Football Player', 'Hockey Player', 'Figure Skater', 'Boxer', 'Wrestler', 'Martial Artist', 'Archer', 'Diver', 'Snowboarder', 'Rower', 'Volleyball Player', 'Cricketer', 'Rugby Player', 'Fencer', 'Track and Field Athlete', 'Triathlete', 'Weightlifter', 'Synchronized Swimmer', 'Equestrian', 'Jockey', 'Rock Climber', 'Skater', 'Biker', 'Surfer', 'Skydiver', 'Canoeist', 'Windsurfer', 'Lacrosse Player', 'Table Tennis Player', 'Badminton Player', 'Polo Player', 'Water Skier', 'Wakeboarder', 'Ultimate Frisbee Player', 'Handball Player', 'Judo Practitioner', 'Karateka', 'Snooker Player', 'Bowler', 'Rainstorm', 'Aurora Borealis', 'Tsunami', 'Earthquake', 'Thunderstorm', 'Rainbow', 'Tornado', 'Solar Eclipse', 'Blizzard', 'Volcanic Eruption', 'Avalanche', 'Meteor Shower', 'Comet', 'Hailstorm', 'Sandstorm', 'Fog', 'Heatwave', 'Ice Storm', 'Monsoon', 'Hurricane', 'Cyclone', 'Waterspout', 'Drought', 'Whirlpool', 'Geysers', 'Avalanche', 'Dust Devil', 'Frost', 'Mist', 'Moonbow', 'Frostbite', 'Diamond Dust', 'Sleet', 'Freezing Rain', 'Virga', 'Haboob', 'Heat Lightning', 'Squall Line', 'Pyrocumulus Cloud', 'Mudslide', 'Waterspout', 'Dust Storm', 'Wind Shear', 'Snowsquall', 'Steam Devil', 'Diamond Dust', 'Sun Pillar', 'Virga', 'Frost Flower', 'Mistral', 'Dragon', 'Unicorn', 'Fairy', 'Mermaid', 'Centaur', 'Griffin', 'Phoenix', 'Troll', 'Elf', 'Werewolf', 'Vampire', 'Ogre', 'Gnome', 'Pegasus', 'Cyclops', 'Chimera', 'Goblin', 'Witch', 'Wizard', 'Satyr', 'Banshee', 'Siren', 'Nymph', 'Leprechaun', 'Minotaur', 'Hydra', 'Harpy', 'Dwarf', 'Yeti', 'Bigfoot', 'Sasquatch', 'Kraken', 'Gargoyle', 'Shapeshifter', 'Thunderbird', 'Valkyrie', 'Djinn', 'Pixie', 'Manticore', 'Basilisk', 'Cerberus', 'Naga', 'Sylph', 'Kitsune', 'Banshee', 'Gryphon', 'Faun', 'Selkie', 'Jackalope', 'Tengu', 'Car', 'Bicycle', 'Motorcycle', 'Train', 'Airplane', 'Ship', 'Bus', 'Truck', 'Helicopter', 'Submarine', 'Hot Air Balloon', 'Rocket', 'Skateboard', 'Scooter', 'Tram', 'Jet Ski', 'Hang Glider', 'Cable Car', 'Segway', 'Rickshaw', 'Paraglider', 'Canoe', 'Kayak', 'Yacht', 'Cruise Ship', 'RV', 'Camper Van', 'Tricycle', 'Golf Cart', 'Wheelchair', 'Rollerblades', 'Horse and Carriage', 'Sled', 'Snowmobile', 'Zeppelin', 'Tuk-tuk', 'Ferry', 'Trolley', 'Jetpack', 'Catamaran', 'Gondola', 'Biplane', 'Monorail', 'Submersible', 'Amphibious Vehicle', 'Segway', 'Unicycle', 'Airship', 'Drone', 'Rickshaw']};
const scenariosDeck = [
  'Wedding ceremony', 'Funeral service', 'Birthday party', 'Graduation ceremony', 'Awards show', 'Concert', 'Theater performance', 'Dance recital', 'Art exhibition', 'Fashion show', 'Conference', 'Business meeting', 'Product launch', 'Networking event', 'Trade show', 'Charity gala', 'Political rally', 'Religious ceremony', 'Cultural festival', 'Parade', 'Sporting event', 'Theme park', 'Museum', 'Zoo', 'Botanical garden', 'Beach party', 'Picnic', 'Barbecue', 'Campfire', 'Campsite', 'Airport', 'Train station', 'Bus terminal', 'Shopping mall', 'Restaurant', 'Coffee shop', 'Park', 'Library', 'Office', 'Classroom', 'Hospital', 'Gym', 'Spa', 'Yoga studio', 'Movie theater', 'Amusement park', 'Stadium', 'Cruise ship', 'Casino', 'Nightclub', 'Farm', 'Vineyard', 'Brewery', 'Ski resort', 'Hotel', 'Motel', 'Beach resort', 'Mountain cabin', 'Cruise liner', 'Theme park', 'Art studio', 'Golf course', 'Tennis court', 'Bowling alley', 'Arcade', 'Casino', 'Roller rink', 'Trampoline park', 'Rock climbing gym', 'Water park', 'Ice rink', 'Comedy club', 'Escape room', 'Planetarium', 'Aquarium', 'Wedding reception', 'Cocktail party', 'Gala dinner', 'Boardroom meeting', 'Brainstorming session', 'Press conference', 'Team-building activity', 'Fundraising event', 'Movie premiere', 'Opera performance', 'Ballet show', 'Cooking class', 'Wine tasting', 'Music festival', 'Cultural exhibition', 'Street fair', 'Costume party', 'Family reunion', 'Anniversary celebration', 'Holiday gathering', 'Thanksgiving dinner', 'Christmas party', "New Year's Eve countdown", 'Baby shower', 'Retirement party', 'Trapped in an elevator', 'In a hurry to catch a flight', 'Stuck in traffic jam', 'Lost in a foreign city', 'Running late for work', 'Nervous before a big presentation', 'Excited on a roller coaster', 'Frustrated with a computer problem', 'Anxious in a crowded space', 'Angry in a customer service line', 'Happy on a sunny beach', 'Relaxed in a cozy hammock', 'Surprised by a birthday surprise party', 'Overwhelmed by a busy schedule', 'Curious in a museum exhibit', 'Bored during a long lecture', 'Amused by a funny movie', 'Sad after a breakup', 'Scared in a haunted house', 'Calm during a meditation session', 'Ecstatic at a concert', 'Exhausted after a long hike', 'Content in a peaceful garden', 'Impatient waiting for a table at a restaurant', 'Overjoyed at a sporting event victory', 'Disappointed by a missed opportunity', 'Enthusiastic at a live performance', 'Tense during a suspenseful movie scene', 'Embarrassed in a public speaking engagement', 'Intrigued by a mystery novel', 'Hopeful in a job interview', 'Focused during a challenging puzzle', 'Amazed by a stunning sunset', 'Irritated by a loud neighbor', 'Proud after accomplishing a goal', 'Puzzled by a difficult riddle', 'Annoyed by a mosquito bite', 'Relieved after a stressful situation', 'Inspired by a motivational speech', 'Indifferent to a mundane task', 'Thrilled on a roller coaster ride', 'Worried about an upcoming exam', 'Impressed by a skillful performance', "Jealous of someone's success", 'Delighted by a surprise gift', 'Discouraged by a setback', "Amused by a comedian's jokes", 'Disgusted by a foul smell', 'Hesitant to make a difficult decision', 'Excited to meet a celebrity', 'Twins playing together', 'Siblings arguing over a toy', 'Mother-in-law giving advice', 'Father-in-law telling jokes', 'Grandparents spoiling the grandchildren', 'Parents helping with homework', "Children's playdate", 'Family dinner around the table', 'Niece and nephew visiting', 'Cousins having a sleepover', 'Son-in-law fixing something for the family', 'Daughter-in-law cooking a meal', 'Brothers playing video games', 'Sisters sharing secrets', 'Family vacation at the beach', 'Aunt and uncle babysitting', 'Family gathering for a holiday', 'Parents cheering at a school event', 'Grandchildren surprising grandparents', 'Family movie night', 'Siblings playing sports together', 'In-laws celebrating an anniversary', "Nephew and niece's birthday party", 'Cousins going on a camping trip', 'Parents teaching their children', 'Grandparents reading bedtime stories', 'Sisters shopping for clothes', 'Brothers building a fort', 'Mother-in-law knitting for the family', 'Father-in-law barbecuing for everyone', 'Parents attending a school play', 'Grandparents sharing family stories', 'Cousins having a game night', 'Brothers and sisters doing chores together', 'Aunt and uncle taking family photos', 'Parents helping with college applications', 'Siblings going on a road trip', 'Family celebrating a graduation', 'Nephew and niece visiting from out of town', "Parents supporting children's hobbies", 'Grandparents teaching a family recipe', 'Sisters and brothers having a picnic', 'In-laws organizing a family reunion', 'Parents and children volunteering together', 'Aunt and uncle hosting a family gathering', 'Cousins playing in the backyard', 'Siblings watching a movie marathon', 'Mother-in-law offering parenting advice', 'Father-in-law helping with home repairs', 'Grandparents playing board games', 'Cocktail party', 'Dinner party', 'Housewarming party', 'Costume party', 'Pool party', 'BBQ party', 'Game night', 'Wine tasting event', 'Charity gala', 'Engagement party', 'Baby shower', 'Wedding reception', 'Graduation party', 'Anniversary celebration', 'Holiday gathering', "New Year's Eve party", 'Office party', 'Bridal shower', 'Retirement party', 'Reunion', 'Bachelor party', 'Bachelorette party', 'Surprise party', 'Art exhibit opening', 'Book club meeting', 'Cooking class', 'Dance party', 'Fashion show', 'Film screening', 'Karaoke night', 'Live music performance', 'Poetry reading', 'Stand-up comedy show', 'TED talk event', 'Theater play', 'Trivia night', 'Yoga retreat', 'Cultural festival', 'Street fair', 'Picnic in the park', 'Beach bonfire', 'Outdoor concert', 'Farmers market', 'Food truck festival', 'Craft fair', 'Wine and cheese tasting', 'Art workshop', 'Community fundraiser', 'Poetry slam', 'Talent show', 'Beer pong tournament', 'Speed dating event', 'Paint and sip night', 'Cooking competition', 'Open mic night', 'Charity run/walk event', 'Stand-up paddleboarding gathering', 'Wine and paint party', 'Film festival', 'Outdoor movie night', 'Comedy roast', 'Fashion runway show', 'Dance competition', 'Potluck dinner', 'Writing workshop', 'Salsa dancing night', 'Drum circle gathering', 'Trivia quiz night', 'Ice cream social', 'Concert in the park', 'Board game marathon', 'Drumming workshop', 'Outdoor yoga session', 'Food and wine pairing event', 'Jazz night', 'Charity auction', 'Silent disco', 'Beer tasting event', 'Craft beer festival', 'Art battle', 'Masquerade ball', 'Film premiere', 'Improv comedy show', 'Charity concert', 'Outdoor theater performance', 'Food festival', 'Bar trivia night', 'Outdoor sports tournament', 'Poetry open mic night', 'Cooking demonstration', 'Wine auction', 'Craft workshop', 'Fashion pop-up shop', 'Artisan market', 'Comedy improv workshop', 'Beer and BBQ festival', 'Dance party cruise', 'Concert series in the park', 'Casino night', 'Food truck rally', 'Enchanted forest', 'Magical kingdom', 'Fairy tale castle', 'Secret garden', 'Underwater realm', 'Mythical island', 'Floating city', "Dragon's lair", "Wizard's tower", 'Elven village', 'Dwarven mine', 'Pixie meadow', "Witch's cottage", 'Mermaid lagoon', 'Goblin market', "Centaur's pasture", 'Unicorn sanctuary', 'Phoenix nest', 'Troll bridge', "Leprechaun's pot of gold", 'Fairy ring', "Griffon's roost", "Giant's playground", "Nymph's waterfall", "Sorcerer's library", 'Enchanted mirror chamber', 'Magical academy', "Goblin king's throne room", "Fairy godmother's cottage", 'Mystic crystal cave', "Ogre's den", "Elf queen's court", 'Talking tree grove', 'Fire-breathing volcano', "Ogre's cooking pot", 'Pixie dust factory', 'Troll under the bridge', 'Fairy wing emporium', "Wizard's spell laboratory", 'Mermaid treasure trove', 'Unicorn grooming stable', "Sorcerer's wand workshop", 'Enchanted waterfall', 'Elf archery range', 'Dragon flying race track', 'Magic carpet bazaar', 'Fairy banquet hall', 'Troll treasure hoard', "Witch's brew cauldron", 'Goblin blacksmith forge', 'Spellbinding potion shop', 'Unicorn carousel', 'Griffin training arena', 'Elven magic forest', 'Dragon hunting grounds', 'Enchanted armor smithy', 'Fairy tale storytelling circle', "Ogre's treasure cave", "Nymph's song garden", "Sorcerer's fortune-telling tent", 'Goblin mischief workshop', 'Pixie dance studio', "Wizard's astronomy observatory", 'Mermaid song cove', 'Fairy wand crafting studio', 'Elf treehouse village', "Dragon's breath cavern", 'Enchanted garden maze', 'Troll wrestling arena', "Witch's broomstick repair shop", 'Magic mirror art gallery', 'Unicorn horn apothecary', "Griffin's nest lookout", 'Goblin prankster academy', 'Pixie glitter factory', "Sorcerer's illusion chamber", 'Fairy baking kitchen', 'Dragon taming school', 'Enchanted forest spa', "Ogre's comedy club", 'Goblin market square', 'Pixie potion laboratory', "Wizard's enchanted garden", 'Mermaid pearl diving cove', 'Elf archer training grounds', "Dragon's treasure chamber", 'Enchanted floating isle', "Sorcerer's crystal ball chamber", 'Fairy tea party garden', 'Troll bridge toll station', "Witch's spellbinding forest", "Griffin's soaring sky sanctuary", "Nymph's hidden oasis", 'Goblin gold mine', 'Pixie dance festival venue', "Wizard's magical artifacts museum", 'Mermaid coral reef kingdom', "Elf kingdom's grand hall", "Dragon's fiery lair", 'Enchanted garden of eternal spring', 'Ancient Greek city-state', 'Egyptian pyramid complex', 'Roman Colosseum', 'Medieval castle', 'Renaissance art studio', 'Viking longhouse', 'Aztec temple', 'Mayan city', 'Chinese imperial palace', 'Japanese samurai dojo', 'Native American village', 'Victorian-era ballroom', 'Industrial Revolution factory', 'Ancient Mesopotamian city', 'Incan fortress', 'Medieval marketplace', 'Mongolian nomadic camp', 'Greek temple ruins', 'Ancient Roman bathhouse', 'Colonial-era tavern', 'Wild West saloon', 'Ancient Egyptian tomb', 'Byzantine cathedral', 'Prehistoric cave dwelling', 'Viking shipyard', 'Renaissance fair', 'World War II bunker', 'Ancient Chinese garden', 'Medieval monastery', "Pharaoh's palace", 'Roman Senate', 'Viking burial site', 'Ancient Mayan observatory', 'Samurai training ground', 'Native American hunting grounds', 'Victorian-era theater', 'Renaissance palace', 'Industrial Revolution mill', 'Aztec marketplace', 'Colonial-era mansion', 'Ancient Greek theater', 'Roman villa', 'Medieval cathedral', 'Egyptian marketplace', 'Viking raiding camp', 'Incan temple complex', 'Samurai tea house', 'Native American ceremonial ground', 'Victorian-era library', 'Renaissance workshop', 'Industrial Revolution foundry', 'Aztec ballcourt', 'Mayan sacrificial site', 'Chinese silk road trading post', 'Native American tribal council grounds', 'Medieval jousting arena', 'Roman public baths', 'Viking longship harbor', 'Renaissance music chamber', 'Industrial Revolution cotton mill', 'Ancient Mesopotamian ziggurat', "Medieval knight's tournament grounds", 'Roman chariot racing stadium', 'Viking trading post', 'Renaissance painting studio', 'Egyptian marketplace', 'Victorian-era seaside promenade', 'Aztec royal palace', 'Mayan pyramid complex', "Chinese scholar's garden", 'Native American storytelling circle', "Medieval alchemist's laboratory", 'Roman forum', 'Viking mead hall', 'Renaissance botanical garden', 'Industrial Revolution railway station', 'Ancient Greek agora', 'Egyptian temple complex', 'Victorian-era orphanage', 'Art gallery', 'Pottery studio', 'Photography studio', 'Sculpture garden', 'Street art exhibition', 'Theater stage', 'Dance studio', 'Opera house', 'Film studio', 'Poetry slam venue', 'Fashion runway', 'Music recording studio', 'Ballet rehearsal room', 'Comedy club', 'Graphic design studio', 'Live painting event', 'Art auction', 'Circus tent', 'Writing retreat', 'Graffiti wall', 'Pottery kiln', 'Photography darkroom', 'Outdoor mural project', 'Costume workshop', 'Jazz club', 'Art installation space', 'Poetry reading cafe', 'Fashion design atelier', 'Music festival stage', 'Theater backstage area', 'Dance performance hall', 'Indie film screening', 'Mixed media art workshop', 'Stand-up comedy venue', 'Graphic novel publishing house', 'Live music venue', 'Poetry writing workshop', 'Fashion boutique', 'Recording booth', 'Ballet performance theater', 'Improv comedy theater', 'Street art tour', 'Pottery throwing demonstration', 'Photography exhibition', 'Sculpture studio', 'Poetry slam competition', 'Fashion photo shoot location', 'Music concert hall', 'Theater costume department', 'Dance choreography studio', 'Independent art cinema', 'Pottery glazing workshop', 'Photography gallery opening', 'Sculpture park', 'Street performance festival', 'Theater rehearsal space', 'Dance improvisation workshop', 'Opera performance venue', 'Film set location', 'Poetry anthology launch event', 'Fashion magazine editorial office', 'Music rehearsal studio', 'Ballet masterclass', 'Comedy improvisation theater', 'Graphic design exhibition', 'Live painting competition', 'Art book fair', 'Circus training center', 'Writing critique group', 'Graffiti artist studio', 'Pottery firing kiln', 'Photography workshop', 'Outdoor art installation', 'Costume design studio', 'Jazz jam session', 'Art residency program', 'Poetry slam championship', 'Fashion runway show venue', "Music recording engineer's studio", 'Theater stage design workshop']};

const moreDeck = []; // Ignore for now

// ==== HELPERS ====
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
const randomDecks = (min=1, max=3) => {
  const keys = Object.keys(decks);
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  return keys.sort(() => 0.5 - Math.random()).slice(0, count);
};

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal, gameModeSelect;

// ==== DRAW CARDS ====
function drawCards() {
  const mode = gameModeSelect.value;
  let drawn = [];

  if (mode === 'classic') {
    drawn = [randomItem(nounsDeck)];
  } else if (mode === 'scenarios') {
    const noun = randomItem(nounsDeck);
    const scenario = randomItem(scenariosDeck);
    drawn = [noun, scenario];
  }

  return drawn;
}

function renderCards(cards) {
  cardArea.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">✨<br>Card</div>
        <div class="card-back">${c}</div>
      </div>`;
    cardArea.appendChild(card);
    setTimeout(() => card.classList.add('flipped'), 300);
  });

  let promptText = 'What do you call a gaggle of: ' + cards[0] + '?';
  if (gameModeSelect.value === 'scenarios') {
    promptText = 'What do you call a gaggle of: ' + cards[0] + ' in a ' + cards[1] + '?';
  }
  promptEl.textContent = promptText;
  promptEl.classList.remove('hidden');
}

// ==== DOM READY ====
document.addEventListener('DOMContentLoaded', () => {
  cardArea = document.getElementById('cardArea');
  promptEl = document.getElementById('prompt');
  answerInput = document.getElementById('answerInput');
  resultModal = document.getElementById('resultModal');
  gameModeSelect = document.getElementById('gameMode');

  // === CLOSE MODAL ON BACKGROUND CLICK ===
  resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) {
      resultModal.classList.add('hidden');
    }
  });

  // === MAIN CLICK HANDLER ===
  document.addEventListener('click', (e) => {
    // Draw Cards
    if (e.target.id === 'drawBtn') {
      const cards = drawCards();
      renderCards(cards);
    }

    // Submit Answer
    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');

      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

      fetch('/.netlify/functions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      })
        .then(res => res.json())
        .then(data => {
          document.getElementById('scoreDisplay').textContent = `Score: ${data.score}/10`;
          document.getElementById('commentDisplay').textContent = data.comment;
          document.getElementById('punDisplay').querySelector('span').textContent = data.pun;
          resultModal.classList.remove('hidden');
          answerInput.value = '';
        })
        .catch(err => {
          console.error('AI Error:', err);
          alert('AI is thinking... try again!');
        });
    }

    // Close Button
    if (e.target.id === 'closeModal') {
      e.stopPropagation();
      resultModal.classList.add('hidden');
    }

    // Share Button
    if (e.target.id === 'shareBtn') {
      e.stopPropagation();
      const scoreText = document.getElementById('scoreDisplay').textContent;
      const text = `I got ${scoreText} in Gaggle! Play: ${location.href}`;
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text).then(() => alert('Score copied to clipboard!'));
      }
    }
  });

  // Reset on mode change
  gameModeSelect.addEventListener('change', () => {
    cardArea.innerHTML = '';
    promptEl.classList.add('hidden');
    answerInput.value = '';
  });
});
