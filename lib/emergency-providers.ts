import type {
  EmergencyProviderType,
  EmergencyProviderInfo,
  ProviderDispatchRequest,
  ProviderDispatchResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Provider Interfaces
// ─────────────────────────────────────────────────────────────────────────────
// Provider interfaces for future emergency partner integrations. Each provider
// type implements the same EmergencyProvider interface, so the dispatch system
// can treat all providers uniformly. These are architecture-only — no real
// API calls are made. When a partner is integrated, only the provider body
// changes; all call sites remain the same.
//
// Supported provider types:
//   - Police (Nigeria Police Force)
//   - Fire Service (Federal Fire Service)
//   - FRSC (Federal Road Safety Corps)
//   - Ambulance (National Ambulance Service)
//   - Hospital (private hospital networks)
//   - Estate Security (gated community security)
//   - Private Security (private security firms)
//   - Roadside Assistance (towing / vehicle repair)

export interface EmergencyProvider {
  readonly type: EmergencyProviderType;
  readonly info: EmergencyProviderInfo;

  // Check if this provider can service the given emergency type / location
  canDispatch(request: ProviderDispatchRequest): boolean;

  // Dispatch the provider to the incident (architecture only — no real call)
  dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────────────────────
// A simple in-memory registry. Future integrations will register real
// providers here. The registry lets the dispatch system look up providers
// by type without knowing the concrete implementation.

class ProviderRegistry {
  private providers = new Map<EmergencyProviderType, EmergencyProvider>();

  register(provider: EmergencyProvider): void {
    this.providers.set(provider.type, provider);
  }

  get(type: EmergencyProviderType): EmergencyProvider | undefined {
    return this.providers.get(type);
  }

  getAll(): EmergencyProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableForRequest(request: ProviderDispatchRequest): EmergencyProvider[] {
    return this.getAll().filter((p) => p.canDispatch(request));
  }
}

export const providerRegistry = new ProviderRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// Abstract Base Provider
// ─────────────────────────────────────────────────────────────────────────────
// Concrete providers extend this class. The dispatch() method is a placeholder
// that logs and returns a simulated result. When a real API is integrated,
// override dispatch() with the actual API call.

export abstract class BaseEmergencyProvider implements EmergencyProvider {
  abstract readonly type: EmergencyProviderType;
  abstract readonly info: EmergencyProviderInfo;

  abstract canDispatch(request: ProviderDispatchRequest): boolean;

  async dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    // TODO: Replace with real API call when partner is integrated.
    // The request contains incidentId, userId, GPS, emergencyType, and notes.
    console.log(`[Provider Dispatch Placeholder] ${this.type}`, request);
    return {
      providerType: this.type,
      accepted: true,
      estimatedArrivalMinutes: this.info.averageResponseMinutes,
      referenceId: `${this.type}-${request.incidentId.slice(0, 8)}`,
      message: `${this.info.name} has been notified (architecture only — no real dispatch).`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Concrete Placeholder Providers
// ─────────────────────────────────────────────────────────────────────────────

class PoliceProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'police';
  readonly info: EmergencyProviderInfo = {
    type: 'police',
    name: 'Nigeria Police Force',
    phone: '112',
    jurisdiction: 'National',
    averageResponseMinutes: 15,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'duress', 'accident', 'other'].includes(request.emergencyType);
  }
}

class FireServiceProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'fire_service';
  readonly info: EmergencyProviderInfo = {
    type: 'fire_service',
    name: 'Federal Fire Service',
    phone: '112',
    jurisdiction: 'National',
    averageResponseMinutes: 20,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'fire', 'accident'].includes(request.emergencyType);
  }
}

class FRSCProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'frsc';
  readonly info: EmergencyProviderInfo = {
    type: 'frsc',
    name: 'Federal Road Safety Corps',
    phone: '122',
    jurisdiction: 'National — Highways',
    averageResponseMinutes: 18,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'accident'].includes(request.emergencyType);
  }
}

class AmbulanceProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'ambulance';
  readonly info: EmergencyProviderInfo = {
    type: 'ambulance',
    name: 'National Ambulance Service',
    phone: '112',
    jurisdiction: 'National',
    averageResponseMinutes: 12,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'medical', 'accident'].includes(request.emergencyType);
  }
}

class HospitalProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'hospital';
  readonly info: EmergencyProviderInfo = {
    type: 'hospital',
    name: 'Private Hospital Network',
    phone: null,
    jurisdiction: 'Regional',
    averageResponseMinutes: 25,
    available247: false,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'medical'].includes(request.emergencyType);
  }
}

class EstateSecurityProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'estate_security';
  readonly info: EmergencyProviderInfo = {
    type: 'estate_security',
    name: 'Estate Security',
    phone: null,
    jurisdiction: 'Local — Estate',
    averageResponseMinutes: 5,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'duress', 'security'].includes(request.emergencyType as string);
  }
}

class PrivateSecurityProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'private_security';
  readonly info: EmergencyProviderInfo = {
    type: 'private_security',
    name: 'Private Security Firm',
    phone: null,
    jurisdiction: 'Contracted areas',
    averageResponseMinutes: 10,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['sos', 'duress'].includes(request.emergencyType);
  }
}

class RoadsideAssistanceProvider extends BaseEmergencyProvider {
  readonly type: EmergencyProviderType = 'roadside_assistance';
  readonly info: EmergencyProviderInfo = {
    type: 'roadside_assistance',
    name: 'Roadside Assistance',
    phone: null,
    jurisdiction: 'National — Major Roads',
    averageResponseMinutes: 30,
    available247: true,
  };

  canDispatch(request: ProviderDispatchRequest): boolean {
    return ['accident'].includes(request.emergencyType);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Register all placeholder providers
// ─────────────────────────────────────────────────────────────────────────────

providerRegistry.register(new PoliceProvider());
providerRegistry.register(new FireServiceProvider());
providerRegistry.register(new FRSCProvider());
providerRegistry.register(new AmbulanceProvider());
providerRegistry.register(new HospitalProvider());
providerRegistry.register(new EstateSecurityProvider());
providerRegistry.register(new PrivateSecurityProvider());
providerRegistry.register(new RoadsideAssistanceProvider());

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: get provider info for all registered providers
// ─────────────────────────────────────────────────────────────────────────────

export function getAllProviderInfo(): EmergencyProviderInfo[] {
  return providerRegistry.getAll().map((p) => p.info);
}

export function getProviderInfo(type: EmergencyProviderType): EmergencyProviderInfo | undefined {
  return providerRegistry.get(type)?.info;
}
