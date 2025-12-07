# Equipment System API Documentation

All routes require JWT authentication via `Authorization: Bearer <token>` header.

Base URL: `/player`

---

## 1. Get Character with Equipment

**GET** `/player/character`

Get the character profile with all equipped items and derived stats.

### Headers
```
Authorization: Bearer <jwt_token>
```

### Response (200 OK)
```json
{
  "id": "char-uuid-123",
  "name": "PlayerName",
  "title": "Novice Warrior",
  "level": 5,
  "experience": 1250,
  "trait": "warrior",
  "appearance": {
    "id": "appearance-uuid",
    "characterId": "char-uuid-123",
    "gender": "male",
    "skinTone": "light",
    "hair": "short",
    "hairColor": "brown",
    "eyes": "blue",
    "mouth": "smile",
    "beard": null,
    "markings": null
  },
  "resources": {
    "id": "resources-uuid",
    "characterId": "char-uuid-123",
    "gold": 5000,
    "shards": 125,
    "pvpTokens": 0,
    "runes": 3,
    "runeCapacityBase": 4,
    "runeCapacityBonus": 0,
    "runeRegenBaseSeconds": 1800,
    "runeRegenMultiplier": 1000,
    "runeRegenAddSeconds": 0,
    "runesUpdatedAt": "2025-01-18T10:00:00.000Z",
    "pvpUpdatedAt": "2025-01-18T10:00:00.000Z"
  },
  "items": [
    {
      "id": "item-uuid-1",
      "slot": "weapon",
      "rarity": "superior",
      "code": "basic_sword",
      "template": {
        "id": "template-uuid-1",
        "code": "basic_sword",
        "name": "Basic Sword",
        "slot": "weapon",
        "baseStats": {
          "attackType": "slashes",
          "damage": 5,
          "critChance": 0.01,
          "element": "physical"
        },
        "iconUrl": "/images/items/weapon/basic_sword.png"
      }
    },
    {
      "id": "item-uuid-2",
      "slot": "chest",
      "rarity": "enchanted",
      "code": "leather_tunic",
      "template": {
        "id": "template-uuid-2",
        "code": "leather_tunic",
        "name": "Leather Tunic",
        "slot": "chest",
        "baseStats": {
          "armor": 3
        },
        "iconUrl": "/images/items/chest/leather_tunic.png"
      }
    }
  ],
  "derivedStats": {
    "damage": 5,
    "armor": 3,
    "critChance": 0.01
  }
}
```

### Response (200 OK - No Character)
```json
{}
```

---

## 2. Get Inventory

**GET** `/player/inventory`

Get all non-equipped items in the character's inventory.

### Headers
```
Authorization: Bearer <jwt_token>
```

### Response (200 OK)
```json
[
  {
    "id": "item-uuid-3",
    "slot": "weapon",
    "rarity": "worn",
    "durability": 100,
    "template": {
      "id": "template-uuid-1",
      "code": "basic_sword",
      "name": "Basic Sword",
      "slot": "weapon",
      "baseStats": {
        "attackType": "slashes",
        "damage": 5,
        "critChance": 0.01,
        "element": "physical"
      },
      "iconUrl": "/images/items/weapon/basic_sword.png"
    }
  },
  {
    "id": "item-uuid-4",
    "slot": "ring",
    "rarity": "heroic",
    "durability": 100,
    "template": {
      "id": "template-uuid-5",
      "code": "magic_ring",
      "name": "Magic Ring",
      "slot": "ring",
      "baseStats": {
        "magic": 10
      },
      "iconUrl": "/images/items/ring/magic_ring.png"
    }
  }
]
```

### Response (200 OK - Empty Inventory)
```json
[]
```

---

## 3. Get Item Details

**GET** `/player/items/:id`

Get detailed information about a specific item by its characterItem.id.

### Headers
```
Authorization: Bearer <jwt_token>
```

### Parameters
- `id` (path parameter): The characterItem.id UUID

### Response (200 OK)
```json
{
  "id": "item-uuid-1",
  "slot": "weapon",
  "rarity": "superior",
  "equipped": true,
  "durability": 100,
  "socketedRunes": null,
  "bonuses": {
    "damage": 2,
    "critChance": 0.02
  },
  "createdAt": "2025-01-18T10:00:00.000Z",
  "template": {
    "id": "template-uuid-1",
    "code": "basic_sword",
    "name": "Basic Sword",
    "slot": "weapon",
    "baseStats": {
      "attackType": "slashes",
      "damage": 5,
      "critChance": 0.01,
      "element": "physical"
    },
    "iconUrl": "/images/items/weapon/basic_sword.png"
  }
}
```

### Error Responses

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Item not found",
  "error": "Not Found"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Cannot view item you do not own",
  "error": "Forbidden"
}
```

---

## 4. Equip Item

**POST** `/player/equipment/equip`

Equip an item from inventory. If an item is already equipped in the same slot, it will be automatically unequipped.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "itemId": "item-uuid-3",
  "slot": "left"
}
```

**Note:** The `slot` parameter is optional. When provided, it's used for sub-slots (left/right) when dual wielding weapons or equipping two rings. If omitted, the item's slot from the template is used.

### Request Body (Without Slot)
```json
{
  "itemId": "item-uuid-3"
}
```

### Response (200 OK)
```json
{
  "equipped": [
    {
      "id": "item-uuid-3",
      "slot": "weapon",
      "rarity": "superior",
      "code": "basic_sword",
      "template": {
        "id": "template-uuid-1",
        "code": "basic_sword",
        "name": "Basic Sword",
        "slot": "weapon",
        "baseStats": {
          "attackType": "slashes",
          "damage": 5,
          "critChance": 0.01,
          "element": "physical"
        },
        "iconUrl": "/images/items/weapon/basic_sword.png"
      }
    },
    {
      "id": "item-uuid-2",
      "slot": "chest",
      "rarity": "enchanted",
      "code": "leather_tunic",
      "template": {
        "id": "template-uuid-2",
        "code": "leather_tunic",
        "name": "Leather Tunic",
        "slot": "chest",
        "baseStats": {
          "armor": 3
        },
        "iconUrl": "/images/items/chest/leather_tunic.png"
      }
    }
  ],
  "derivedStats": {
    "damage": 5,
    "armor": 3,
    "critChance": 0.01
  }
}
```

### Error Responses

**400 Bad Request** - Item already equipped in different slot
```json
{
  "statusCode": 400,
  "message": "Item is already equipped in a different slot",
  "error": "Bad Request"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Item not found",
  "error": "Not Found"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Cannot equip item you do not own",
  "error": "Forbidden"
}
```

---

## 5. Unequip Item

**POST** `/player/equipment/unequip`

Unequip an item and move it back to inventory.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "itemId": "item-uuid-1"
}
```

**Note:** The `slot` parameter is not used for unequip, but the DTO accepts it (it will be ignored).

### Response (200 OK)
```json
{
  "equipped": [
    {
      "id": "item-uuid-2",
      "slot": "chest",
      "rarity": "enchanted",
      "code": "leather_tunic",
      "template": {
        "id": "template-uuid-2",
        "code": "leather_tunic",
        "name": "Leather Tunic",
        "slot": "chest",
        "baseStats": {
          "armor": 3
        },
        "iconUrl": "/images/items/chest/leather_tunic.png"
      }
    }
  ],
  "derivedStats": {
    "armor": 3
  }
}
```

### Error Responses

**400 Bad Request** - Item not equipped
```json
{
  "statusCode": 400,
  "message": "Item is not equipped",
  "error": "Bad Request"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Item not found",
  "error": "Not Found"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Cannot unequip item you do not own",
  "error": "Forbidden"
}
```

---

## Item Slot Types

Valid `ItemSlot` enum values:
- `helmet`
- `chest`
- `glove`
- `feet`
- `weapon`
- `shield`
- `cape`
- `ring`
- `neck`
- `legs`

## Item Rarity Types

Valid `ItemRarity` enum values:
- `worn`
- `superior`
- `enchanted`
- `heroic`
- `relic`
- `celestial`

---

## Notes

1. **Derived Stats**: The `derivedStats` object contains the sum of all `baseStats` from item templates plus all `bonuses` from CharacterItem records. Only numeric values are included.

2. **Slot Parameter**: The `slot` parameter in equip requests is for future sub-slot support (left/right for weapons/rings). Currently, it's stored but the system uses the item's template slot for database operations.

3. **Auto-Unequip**: When equipping an item, any item already equipped in the same slot is automatically unequipped.

4. **Idempotent Equip**: If you try to equip an item that's already equipped in the correct slot, the request succeeds and returns the current state without making changes.


