-- Hexa Hub Pop-Up — June 7 Vendor Seed
-- Run this in Supabase SQL editor to bulk-insert all vendors from the spreadsheet.
-- Safe to re-run — uses ON CONFLICT DO NOTHING.

INSERT INTO event_bookings (id, data, updated_at) VALUES

('eb_flashy_finish', '{
  "id": "eb_flashy_finish",
  "ref": "VND-001",
  "status": "draft",
  "vendorName": "Charlie Hines",
  "vendorBusiness": "Flashy Finish",
  "vendorEmail": "charlesfmhines@gmail.com",
  "vendorPhone": "0411 558 343",
  "vendorAbn": "50 275 979 572",
  "vendorType": "Products / Retail",
  "vendorDescription": "Car detailing brand that sells premium car cleaning products and accessories for enthusiasts and everyday car owners.",
  "instagramHandle": "flashyfinish",
  "allocatedSpace": "13",
  "carDetails": "BMW M4 F",
  "specialConditions": "No Public Liability Insurance — follow up required",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_nomerci', '{
  "id": "eb_nomerci",
  "ref": "VND-002",
  "status": "draft",
  "vendorName": "Harrison Chamaa",
  "vendorBusiness": "NoMerci",
  "vendorEmail": "credereft@gmail.com",
  "vendorPhone": "0497 888 111",
  "vendorAbn": "19 673 766 437",
  "vendorType": "Products / Retail",
  "vendorDescription": "Automotive Racing Apparel business.",
  "instagramHandle": "nomerci.store",
  "allocatedSpace": "12",
  "carDetails": "Lamborghini Mercy / Vet or Diablo",
  "specialConditions": "No Public Liability Insurance — follow up required",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_zero_offset', '{
  "id": "eb_zero_offset",
  "ref": "VND-003",
  "status": "draft",
  "vendorName": "Zero Offset",
  "vendorBusiness": "Zero Offset",
  "vendorEmail": "",
  "vendorPhone": "",
  "vendorType": "Products / Retail",
  "vendorDescription": "Pending details.",
  "specialConditions": "Pending — details not yet received",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_loan_porter', '{
  "id": "eb_loan_porter",
  "ref": "VND-004",
  "status": "draft",
  "vendorName": "Kathryn Ma",
  "vendorBusiness": "Loan Porter",
  "vendorEmail": "kathryn.ma@loanporter.com.au",
  "vendorPhone": "0410 353 399",
  "vendorAbn": "27 659 075 055",
  "vendorType": "Services",
  "vendorDescription": "Tailored lending solutions across home loans, car finance, asset finance, mortgage management, and broader financial services. 15+ years experience.",
  "instagramHandle": "loanporter_",
  "allocatedSpace": "24",
  "carDetails": "Black AE68",
  "specialConditions": "No Public Liability Insurance — follow up required. Secondary contact: Jhomel Dickens — Jhomel.Dickens@loanporter.com.au",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_brixton_insurance', '{
  "id": "eb_brixton_insurance",
  "ref": "VND-005",
  "status": "draft",
  "vendorName": "Jitesh Gil",
  "vendorBusiness": "Brixton Insurance / Prestige Car Insurance",
  "vendorEmail": "jitesh@brixtoninsurance.com.au",
  "vendorPhone": "0404 339 815",
  "vendorAbn": "58 685 857 925",
  "vendorType": "Services",
  "vendorDescription": "Prestige car insurance and insurance broker.",
  "instagramHandle": "brixtoninsurance",
  "allocatedSpace": "44/30",
  "carDetails": "Yaris / C63",
  "specialConditions": "Bring coffee stand",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_platinum_lab', '{
  "id": "eb_platinum_lab",
  "ref": "VND-006",
  "status": "draft",
  "vendorName": "Adem Duramanoglu",
  "vendorBusiness": "Platinum Lab",
  "vendorEmail": "Adem@Platinumlab.com.au",
  "vendorPhone": "0417 555 689",
  "vendorAbn": "43 651 837 587",
  "vendorType": "Services",
  "vendorDescription": "Ceramic coating and car detailing.",
  "allocatedSpace": "44",
  "carDetails": "Mark 4 Supra / Grey M3",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_drive_deck', '{
  "id": "eb_drive_deck",
  "ref": "VND-007",
  "status": "draft",
  "vendorName": "Christopher Lai",
  "vendorBusiness": "Drive Deck",
  "vendorEmail": "info@drivedeck.com.au",
  "vendorPhone": "0433 339 038",
  "vendorAbn": "21 695 368 784",
  "vendorType": "Products / Retail",
  "vendorDescription": "Custom skateboard art.",
  "instagramHandle": "drivedeckaus",
  "carDetails": "No car — small booth",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_across_japan', '{
  "id": "eb_across_japan",
  "ref": "VND-008",
  "status": "draft",
  "vendorName": "Ryota",
  "vendorBusiness": "Across Japan",
  "vendorEmail": "ryota@acrossjpn.com",
  "vendorPhone": "0415 122 617",
  "vendorType": "Car Display",
  "vendorDescription": "JDM export company based in Kanagawa, Japan.",
  "instagramHandle": "acrossjpn.au",
  "carDetails": "Honda S2000 (confirmed). GTR if 2 car spots available.",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_high_demand', '{
  "id": "eb_high_demand",
  "ref": "VND-009",
  "status": "draft",
  "vendorName": "Dan",
  "vendorBusiness": "High Demand and Customs",
  "vendorEmail": "",
  "vendorPhone": "0413 735 905",
  "vendorType": "Car Display",
  "carDetails": "2 cars",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_roomingkos', '{
  "id": "eb_roomingkos",
  "ref": "VND-010",
  "status": "draft",
  "vendorName": "Julian Djung",
  "vendorBusiness": "RoomingKos",
  "vendorEmail": "Julian@roomingkos.com",
  "vendorPhone": "0433 898 009",
  "vendorAbn": "67 137 007 937",
  "vendorType": "Brand Activation",
  "vendorDescription": "All-inclusive accommodation service for students and young professionals, with hundreds of rooms available throughout Melbourne.",
  "instagramHandle": "roomingkos",
  "allocatedSpace": "58",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_rmr_automotive', '{
  "id": "eb_rmr_automotive",
  "ref": "VND-011",
  "status": "draft",
  "vendorName": "Rhiannon Jane Marshall",
  "vendorBusiness": "RMR Automotive",
  "vendorEmail": "rmrservicing@gmail.com",
  "vendorPhone": "0452 386 473",
  "vendorAbn": "22 639 202 476",
  "vendorType": "Services",
  "vendorDescription": "Mechanical repair shop.",
  "instagramHandle": "rmrautomotive",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_prestige_car_connect', '{
  "id": "eb_prestige_car_connect",
  "ref": "VND-012",
  "status": "draft",
  "vendorName": "Danny",
  "vendorBusiness": "Prestige Car Connect",
  "vendorEmail": "",
  "vendorPhone": "0430 336 661",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_burn_city_legal', '{
  "id": "eb_burn_city_legal",
  "ref": "VND-013",
  "status": "draft",
  "vendorName": "Younis",
  "vendorBusiness": "Burn City Legal",
  "vendorEmail": "",
  "vendorPhone": "0468 420 001",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_wrap_haven', '{
  "id": "eb_wrap_haven",
  "ref": "VND-014",
  "status": "draft",
  "vendorName": "Luke",
  "vendorBusiness": "Wrap Haven",
  "vendorEmail": "",
  "vendorPhone": "0411 344 172",
  "vendorType": "Services",
  "vendorDescription": "Car wrapping.",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_dint2mint', '{
  "id": "eb_dint2mint",
  "ref": "VND-015",
  "status": "draft",
  "vendorName": "Maher",
  "vendorBusiness": "Dint2mint",
  "vendorEmail": "",
  "vendorPhone": "0481 989 737",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_wrap_village', '{
  "id": "eb_wrap_village",
  "ref": "VND-016",
  "status": "draft",
  "vendorName": "Ron",
  "vendorBusiness": "Wrap Village",
  "vendorEmail": "",
  "vendorPhone": "0412 714 029",
  "vendorType": "Services",
  "vendorDescription": "Car wrapping.",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_profab', '{
  "id": "eb_profab",
  "ref": "VND-017",
  "status": "draft",
  "vendorName": "Rocky",
  "vendorBusiness": "Profab",
  "vendorEmail": "",
  "vendorPhone": "0421 547 468",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_2step_garage', '{
  "id": "eb_2step_garage",
  "ref": "VND-018",
  "status": "draft",
  "vendorName": "Mike",
  "vendorBusiness": "2 Step Garage",
  "vendorEmail": "",
  "vendorPhone": "0431 271 642",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_autohaus', '{
  "id": "eb_autohaus",
  "ref": "VND-019",
  "status": "draft",
  "vendorName": "Aladin",
  "vendorBusiness": "Autohaus Performance",
  "vendorEmail": "",
  "vendorPhone": "0452 260 425",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_fawkner_wheels', '{
  "id": "eb_fawkner_wheels",
  "ref": "VND-020",
  "status": "draft",
  "vendorName": "Omar",
  "vendorBusiness": "Fawkner Wheels and Tyres",
  "vendorEmail": "",
  "vendorPhone": "0431 097 810",
  "vendorType": "Services",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW()),

('eb_flipside_ap', '{
  "id": "eb_flipside_ap",
  "ref": "VND-021",
  "status": "draft",
  "vendorName": "Flip Side AP",
  "vendorBusiness": "Flip Side AP",
  "vendorEmail": "",
  "vendorPhone": "",
  "vendorType": "Other",
  "specialConditions": "Pending — details not yet received",
  "createdAt": "2026-05-19",
  "updatedAt": "2026-05-19"
}'::jsonb, NOW())

ON CONFLICT (id) DO NOTHING;
