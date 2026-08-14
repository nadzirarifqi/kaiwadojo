// src/types/index.ts

// src/types/index.ts
export interface User {
  userID: string;      // Sesuai header: userID
  username: string;
  password?: string;
  owner_name: string;  // Sesuai header: owner_name
  email: string;
  phone: string;
  role: 'Recipe Developer' | 'Menu Planner' | 'Supplier';
}

export interface MenuDatabases {
  MenuID: string;      // Sesuai header: MenuID
  UserID: string;      // Sesuai header: UserID
  ActivityID: string;
  Menu_Name: string;   // Sesuai header: Menu_Name
  Menu_Description: string;
  Menu_Image: string;
  Menu_Video: string;
  Total_Nutrition: string; // JSON String
  Status: 'Waiting' | 'Approved' | 'Rejected';
  ApprovalDate?: string;
  Timestamp: string;
  targetAKG: string;   // JSON String
  Menu_Procedure: string; // JSON String
}

export interface MenuIngredients {
  IngredientID: string; // Sesuai header: IngredientID
  MenuID: string;       // Sesuai header: MenuID
  ActivityID: string;
  Ingredients_JSON: string; // JSON String
  Ingredients_1000_JSON: string; // JSON String
  TimeStamp: string;

}

export interface IngredientsDatabase{
  IngredientID: string; // Sesuai header: IngredientID
  Ingredient_Name: string; // Sesuai header: Ingredient_Name
  Berat_Standar_Gram: number; // Sesuai header: Berat_Standar_Gram
}

export interface URTDatabase{
  URTID: string; // Sesuai header: URTID
  URT_Name: string; // Sesuai header: URT_Name
  Description: string; // Sesuai header: Keterangan
}
// 3. Interface untuk Sheet "Menu Schedules"
export interface MenuSchedule {
  LogID: string;
  Date: string; // Format: YYYY-MM-DD
  Group_Name: string;
  Insitution_Name: string;
  Male_Count: number;
  Female_Count: number;
  Total_Portions: number;
  MenuID: string;
  Menu_Name: string;
  Ingredients_Used: string; // JSON String
  Op_Costs: number;
  PlannerID: string;
  Timestamp: string;
  Export_Status: 'Pending' | 'Exported';
}

// 4. Interface umum untuk API Response
export interface ApiResponse<T> {
  status: 'Authenticated' | 'Successful' | 'Error';
  message?: string;
  data?: T;
  userId?: string; // Khusus login
  owner?: string;  // Khusus login
  role?: string;   // Khusus login
}