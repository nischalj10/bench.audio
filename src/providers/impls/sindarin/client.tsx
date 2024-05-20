declare global {
    interface Window {
      PersonaClient: any;
    }
  }
  
  const startSindarinClient = async (publicApiKey: string, userId?: string, personaName?: string) => {
    const script = document.createElement("script");
    script.src = `https://api.prod.centralus.az.sindarin.tech/PersonaClientPublic?apikey=${publicApiKey}`;
    document.head.appendChild(script);
  
    return new Promise((resolve, reject) => {
      script.onload = async () => {
        const personaClient = new window.PersonaClient(publicApiKey);
        await personaClient.init({ userId, personaName });
        resolve(personaClient);
      };
      script.onerror = () => {
        reject(new Error("Failed to load the Sindarin Persona Client"));
      };
    });
  };
  
  export default startSindarinClient;