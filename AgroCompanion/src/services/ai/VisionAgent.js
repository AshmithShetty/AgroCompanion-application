import { ConfigService } from '../../utils/ConfigService';
import { NetworkMonitor } from '../NetworkMonitor';

export const VisionAgent = {
  analyzeImage: async (imageUri) => {
    const isOnline = await NetworkMonitor.checkConnection();

    if (!isOnline) {
      return 'Offline: unable to perform vision analysis. Please connect to the internet and try again.';
    }

    if (!ConfigService.ENABLE_AI || !ConfigService.AZURE_VISION_KEY || !ConfigService.AZURE_VISION_ENDPOINT) {
      return 'Vision analysis is disabled or API keys are not configured.';
    }

    try {
      const endpoint = ConfigService.AZURE_VISION_ENDPOINT.replace(/\/$/, '');
      const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=caption,tags,objects`;

      let bodyJson;
      if (imageUri.startsWith('data:') || imageUri.startsWith('blob:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const analysisResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': ConfigService.AZURE_VISION_KEY,
            'Content-Type': 'application/octet-stream',
          },
          body: bytes,
        });

        const data = await analysisResponse.json();
        return formatVisionResult(data);
      } else {
        const analysisResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': ConfigService.AZURE_VISION_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: imageUri }),
        });

        const data = await analysisResponse.json();
        return formatVisionResult(data);
      }
    } catch (error) {
      console.error('VisionAgent error:', error);
      return `Vision analysis failed: ${error.message}. Please try again.`;
    }
  }
};

const formatVisionResult = (data) => {
  if (!data || data.error) {
    return `Vision API error: ${data?.error?.message || 'Unknown error'}`;
  }

  const parts = [];

  if (data.captionResult?.text) {
    parts.push(`Description: ${data.captionResult.text} (confidence ${(data.captionResult.confidence * 100).toFixed(1)}%)`);
  }

  if (data.tagsResult?.values?.length > 0) {
    const tags = data.tagsResult.values
      .filter(t => t.confidence > 0.6)
      .map(t => t.name)
      .slice(0, 8)
      .join(', ');
    if (tags) parts.push(`Detected: ${tags}`);
  }

  if (data.objectsResult?.values?.length > 0) {
    const objects = data.objectsResult.values.map(o => o.tags?.[0]?.name || o.name).join(', ');
    if (objects) parts.push(`Objects: ${objects}`);
  }

  if (parts.length === 0) {
    return 'Vision analysis complete. No significant features detected in this image.';
  }

  return parts.join('\n');
};