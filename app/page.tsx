export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6">
        
        <h1 className="text-3xl font-bold mb-2">
          Presenze Cantiere
        </h1>

        <p className="text-gray-600 mb-6">
          Sistema operativo aziendale
        </p>

        <div className="space-y-4">

          <button className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold">
            Timbra Entrata
          </button>

          <button className="w-full bg-yellow-500 text-white py-4 rounded-xl text-lg font-semibold">
            Inizio Pausa
          </button>

          <button className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold">
            Fine Pausa
          </button>

          <button className="w-full bg-red-600 text-white py-4 rounded-xl text-lg font-semibold">
            Timbra Uscita
          </button>

        </div>
      </div>
    </main>
  );
}