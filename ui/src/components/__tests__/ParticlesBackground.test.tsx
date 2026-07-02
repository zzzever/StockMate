import { render } from '@testing-library/react';
import ParticlesBackground from '@/components/ParticlesBackground';

describe('ParticlesBackground', () => {
  it('renders 30 particles inside container', () => {
    const { container } = render(<ParticlesBackground />);
    const particlesContainer = container.querySelector('.particles-container');
    expect(particlesContainer).toBeInTheDocument();
    expect(particlesContainer?.children.length).toBe(30);
  });
});
