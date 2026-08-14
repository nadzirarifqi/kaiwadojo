// src/services/api.ts
export const scriptURL = 'https://script.google.com/macros/s/AKfycbyd-hvyZVNLAgIFVILFCEMZK1ZvkzJPNNWjnQsPiAvDKdRrAWl5Z8eCJ0Ki_jobq6uNgw/exec';
import Swal from 'sweetalert2'

/**
 * Fungsi Helper untuk mengubah Object menjadi Query String URL
 * Contoh: { MenuID: 'M001' } jadi &MenuID=M001
 */
const objectToQueryString = (obj: any): string => {
  if (!obj) return "";
  if (typeof obj === 'string') return obj; // Jika sudah string, langsung kembalikan
  
  return Object.keys(obj)
    .map(key => `&${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join("");
};

export async function apiCall<T>(
  action: string, 
  sheet: string = "", 
  params: any = "" 
): Promise<T | null> {
    try {
        // Daftar action yang wajib menggunakan POST (karena data besar/kompleks)
        const postActions = ['addMenu', 'updateMenu', 'uploadImage', 'register', 'saveDailyReport'];
        const isPost = postActions.includes(action);

        let response;

        if (isPost) {
            const finalURL = `${scriptURL}?action=${action}&targetSheet=${encodeURIComponent(sheet)}`;
            
            response = await fetch(finalURL, {
                method: 'POST',
                mode: 'cors', // Pastikan mode cors aktif
                headers: {
                    // Gunakan text/plain untuk menghindari preflight OPTIONS request
                    'Content-Type': 'text/plain;charset=utf-8', 
                },
                body: JSON.stringify(params) 
            });
        } else {
            // Jika GET (readAll, deleteMenu, dll)
            const extraParams = objectToQueryString(params);
            const finalURL = `${scriptURL}?action=${action}&targetSheet=${encodeURIComponent(sheet)}${extraParams}`;
            response = await fetch(finalURL);
        }

        if (!response.ok) throw new Error("Koneksi server terputus");

        // GAS sering mengembalikan text murni "Success" untuk POST
        const contentType = response.headers.get("content-type");
        let result;
        
        if (contentType && contentType.indexOf("application/json") !== -1) {
            result = await response.json();
        } else {
            result = await response.text();
        }

        // Error handling standar
        if (result?.status === "Error" || (typeof result === 'string' && result.includes("Error"))) {
            throw new Error(typeof result === 'string' ? result : result.message);
        }

        return result as T;
    } catch (error: any) {
        // Jangan tampilkan Swal jika upload image sedang berjalan (opsional)
        Swal.fire('Oops!', error.message || 'Terjadi gangguan sistem', 'error');
        return null;
    }
}

export async function sendLog(userId: string, userName: string, event: string, details: string) {
    const params = { userId, name: userName, event, details };
    const finalURL = `${scriptURL}?action=logOnly${objectToQueryString(params)}`;
    return fetch(finalURL);
}